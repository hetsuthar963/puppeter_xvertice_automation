const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const imagesDirectory = path.join(__dirname, "src");
const inputFileSelector = "#file-upload";

const successfulUploads = [];
const failedUploads = [];

// Helper function to wait for user input
const waitForUserInput = (prompt) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// Color codes for different types and statuses
const colors = {
  reset: "\x1b[0m",
  timestamp: "\x1b[90m", // Gray
  types: {
    PROCESS: "\x1b[36m", // Cyan
    FILE: "\x1b[34m", // Blue
    UPLOAD: "\x1b[35m", // Magenta
    BUTTON: "\x1b[33m", // Yellow
    REMOVE: "\x1b[31m", // Red
    CHECK: "\x1b[32m", // Green
    AUTH: "\x1b[36m", // Cyan
    INPUT: "\x1b[34m", // Blue
    NAVIGATE: "\x1b[35m", // Magenta
    CLEANUP: "\x1b[33m", // Yellow
    ERROR: "\x1b[31m", // Red
  },
  status: {
    START: "\x1b[36m", // Cyan
    SUCCESS: "\x1b[32m", // Green
    FAIL: "\x1b[31m", // Red
    INFO: "\x1b[37m", // White
  },
};

// Helper function for formatted logging
const log = (type, status, message, retryInfo = "") => {
  const timestamp = new Date().toISOString();
  console.log(
    `${colors.timestamp}${timestamp}${colors.reset} | ` +
      `${colors.types[type] || ""}${type.padEnd(12)}${colors.reset} | ` +
      `${colors.status[status] || ""}${status.padEnd(8)}${colors.reset} | ` +
      `${message.padEnd(40)} || ${retryInfo}`
  );
};

// Add these helper functions before the main execution block
const showMenu = async () => {
  console.log("\n=== Upload Menu ===");
  console.log("1. Run for all failed uploads");
  console.log("2. Terminate process");
  console.log("3. Run for individual file");
  const choice = await waitForUserInput("\nEnter your choice (1-3): ");
  return choice;
};

const getIndividualFile = async (images) => {
  console.log("\nAvailable files in src directory:");
  images.forEach((file) => {
    console.log(`${file}`);
  });
  const fileName = await waitForUserInput("\nEnter the exact file name: ");
  if (images.includes(fileName)) {
    return fileName;
  }
  return null;
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // Get the maximum screen size
  const screen = await page.evaluate(() => ({
    width: window.screen.availWidth,
    height: window.screen.availHeight,
  }));

  // Set viewport to maximum screen size
  await page.setViewport({
    width: screen.width,
    height: screen.height,
    deviceScaleFactor: 1,
  });

  // Navigate to the page where the file input exists
  const websiteUrl = "https://www.x-vertice.com/analysis";
  log("NAVIGATE", "START", `Navigating to: ${websiteUrl}`);
  await page.goto(websiteUrl);

  // Wait for manual authentication
  log("AUTH", "INFO", "Please authenticate manually in the browser.");
  await waitForUserInput(
    "Press Enter after you have successfully authenticated..."
  );

  // Wait for the file input to appear and cache it
  let fileInput;
  try {
    log("INPUT", "START", "Waiting for file input to appear...");
    await page.waitForSelector(inputFileSelector, { timeout: 10000 });
    fileInput = await page.$(inputFileSelector);
    if (!fileInput) {
      log("INPUT", "FAIL", "File input not found. Exiting...");
      return;
    }
    log("INPUT", "SUCCESS", "File input detected and cached.");
  } catch (error) {
    log("INPUT", "FAIL", "File input not found within the timeout period.");
    return;
  }

  // Helper function to remove existing file if present
  const removeExistingFile = async () => {
    try {
      const removeButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        return (
          buttons.find((btn) => btn.textContent.trim() === "Remove file") ||
          null
        );
      });

      const removeButtonExists = await page.evaluate(
        (button) => !!button,
        removeButton
      );

      if (removeButtonExists) {
        log(
          "REMOVE",
          "INFO",
          "Found existing file, waiting for remove button to become enabled..."
        );

        // Wait for remove button to become enabled
        let removeButtonEnabled = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          removeButtonEnabled = await page.evaluate((button) => {
            if (!button) return false;
            return (
              window.getComputedStyle(button).opacity !== "0.5" &&
              !button.disabled
            );
          }, removeButton);

          if (removeButtonEnabled) {
            log(
              "REMOVE",
              "SUCCESS",
              "Remove button is now enabled",
              `Attempt: ${attempt + 1}/100`
            );
            break;
          }

          log(
            "REMOVE",
            "INFO",
            "Remove button is still disabled",
            `Retry: ${attempt + 1}/100`
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!removeButtonEnabled) {
          log(
            "REMOVE",
            "FAIL",
            "Remove button did not become enabled after retries."
          );
          return;
        }

        // Click the enabled remove button
        await removeButton.click();
        await page.waitForFunction(
          () => {
            const buttons = Array.from(document.querySelectorAll("button"));
            return !buttons.some(
              (btn) => btn.textContent.trim() === "Remove file"
            );
          },
          { timeout: 5000 }
        );
        log("REMOVE", "SUCCESS", "Existing file removed successfully.");
      }
    } catch (error) {
      log("REMOVE", "FAIL", `Error removing existing file: ${error.message}`);
    }
  };

  // Get the list of images to upload
  const images = fs
    .readdirSync(imagesDirectory)
    .filter((file) => file.endsWith(".jpg") || file.endsWith(".png"));

  if (images.length === 0) {
    log("PROCESS", "FAIL", "No images found in the directory. Exiting...");
    return;
  }

  // Start processing files
  log("PROCESS", "START", `Found ${images.length} images to process`);

  for (let image of images) {
    const imagePath = path.join(imagesDirectory, image);
    log("FILE", "INFO", `Processing: ${image}`);

    try {
      log("CHECK", "START", "Looking for existing file");
      await removeExistingFile();

      await new Promise((resolve) => setTimeout(resolve, 500));

      log("UPLOAD", "START", "Uploading new file");
      await page.evaluate((selector) => {
        const fileInput = document.querySelector(selector);
        if (fileInput) fileInput.value = "";
      }, inputFileSelector);

      const input = await page.$(inputFileSelector);
      await input.uploadFile(imagePath);

      await page.waitForFunction(
        (selector) => {
          const input = document.querySelector(selector);
          return input && input.files && input.files.length > 0;
        },
        { timeout: 5000 },
        inputFileSelector
      );
      log("UPLOAD", "SUCCESS", "File loaded into input");

      log("BUTTON", "START", "Waiting for upload button");
      let uploadButton;
      try {
        await page.waitForFunction(
          () => {
            const buttons = Array.from(document.querySelectorAll("button"));
            return buttons.some((btn) => btn.textContent.trim() === "Upload");
          },
          { timeout: 10000 }
        );

        uploadButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const button = buttons.find(
            (btn) => btn.textContent.trim() === "Upload"
          );
          return button || null;
        });

        if (!uploadButton) {
          log(
            "BUTTON",
            "FAIL",
            "Upload button not found after file input. Skipping..."
          );
          continue;
        }
        log("BUTTON", "SUCCESS", "Upload button detected.");
      } catch (error) {
        log(
          "BUTTON",
          "FAIL",
          `Error locating the upload button: ${error.message}`
        );
        continue;
      }

      try {
        log(
          "BUTTON",
          "INFO",
          "Waiting for the upload button to become enabled..."
        );
        let buttonEnabled = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          buttonEnabled = await page.evaluate((button) => {
            if (!button) return false;
            return (
              window.getComputedStyle(button).opacity !== "0.5" &&
              !button.disabled
            );
          }, uploadButton);

          if (buttonEnabled) {
            log(
              "BUTTON",
              "SUCCESS",
              "Upload button is now enabled",
              `Attempt: ${attempt + 1}/100`
            );
            break;
          }

          log(
            "BUTTON",
            "INFO",
            "Upload button is still disabled",
            `Retry: ${attempt + 1}/100`
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!buttonEnabled) {
          log(
            "BUTTON",
            "FAIL",
            "Upload button did not become enabled after retries. Skipping..."
          );
          continue;
        }
      } catch (error) {
        log(
          "BUTTON",
          "FAIL",
          `Error waiting for the upload button to become enabled: ${error.message}`
        );
        continue;
      }

      try {
        log("BUTTON", "INFO", "Clicking the upload button...");
        await uploadButton.click();
        log("BUTTON", "SUCCESS", "Upload button clicked successfully.");
      } catch (error) {
        log(
          "BUTTON",
          "FAIL",
          `Error clicking the upload button: ${error.message}`
        );
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      log("CLEANUP", "START", "Removing uploaded file");
      try {
        const removeButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          return (
            buttons.find((btn) => btn.textContent.trim() === "Remove file") ||
            null
          );
        });

        const removeButtonExists = await page.evaluate(
          (button) => !!button,
          removeButton
        );

        if (removeButtonExists) {
          log("REMOVE", "INFO", "'Remove file' button detected. Clicking...");
          await removeButton.click();
          log(
            "REMOVE",
            "SUCCESS",
            "'Remove file' button clicked successfully."
          );
        }
      } catch (error) {
        log(
          "REMOVE",
          "FAIL",
          `Error with Remove file button: ${error.message}`
        );
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      successfulUploads.push(image);
      log("FILE", "SUCCESS", `Completed processing ${image}`);
    } catch (error) {
      failedUploads.push(image);
      log("ERROR", "FAIL", `Failed processing ${image}: ${error.message}`);
      continue;
    }
  }

  log("PROCESS", "END", `Completed processing ${images.length} files`);
  log(
    "PROCESS",
    "INFO",
    `Successfully uploaded: ${successfulUploads.length} files`
  );
  log("PROCESS", "INFO", `Failed uploads: ${failedUploads.length} files`);

  if (successfulUploads.length > 0) {
    log("PROCESS", "SUCCESS", "Successfully uploaded files:");
    successfulUploads.forEach((file) => {
      log("FILE", "SUCCESS", `✓ ${file}`);
    });
  }

  if (failedUploads.length > 0) {
    log("PROCESS", "FAIL", "Failed uploads:");
    failedUploads.forEach((file) => {
      log("FILE", "FAIL", `✗ ${file}`);
    });

    const choice = await showMenu();
    let imagesToProcess = [];

    switch (choice) {
      case "1":
        imagesToProcess = failedUploads;
        log("PROCESS", "START", "Retrying failed uploads...");
        break;
      case "2":
        log("PROCESS", "INFO", "Process terminated by user");
        await browser.close();
        return;
      case "3":
        const selectedFile = await getIndividualFile(failedUploads);
        if (selectedFile) {
          imagesToProcess = [selectedFile];
          log("PROCESS", "START", `Processing selected file: ${selectedFile}`);
        } else {
          log("PROCESS", "FAIL", "Invalid file selected. Exiting...");
          await browser.close();
          return;
        }
        break;
      default:
        log("PROCESS", "FAIL", "Invalid choice. Exiting...");
        await browser.close();
        return;
    }

    // Process the selected files
    if (imagesToProcess.length > 0) {
      for (let image of imagesToProcess) {
        const imagePath = path.join(imagesDirectory, image);
        log("FILE", "INFO", `Processing: ${image}`);

        try {
          log("CHECK", "START", "Looking for existing file");
          await removeExistingFile();

          await new Promise((resolve) => setTimeout(resolve, 500));

          log("UPLOAD", "START", "Uploading new file");
          await page.evaluate((selector) => {
            const fileInput = document.querySelector(selector);
            if (fileInput) fileInput.value = "";
          }, inputFileSelector);

          const input = await page.$(inputFileSelector);
          await input.uploadFile(imagePath);

          await page.waitForFunction(
            (selector) => {
              const input = document.querySelector(selector);
              return input && input.files && input.files.length > 0;
            },
            { timeout: 5000 },
            inputFileSelector
          );
          log("UPLOAD", "SUCCESS", "File loaded into input");

          log("BUTTON", "START", "Waiting for upload button");
          let uploadButton;
          try {
            await page.waitForFunction(
              () => {
                const buttons = Array.from(document.querySelectorAll("button"));
                return buttons.some(
                  (btn) => btn.textContent.trim() === "Upload"
                );
              },
              { timeout: 10000 }
            );

            uploadButton = await page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll("button"));
              const button = buttons.find(
                (btn) => btn.textContent.trim() === "Upload"
              );
              return button || null;
            });

            if (!uploadButton) {
              log(
                "BUTTON",
                "FAIL",
                "Upload button not found after file input. Skipping..."
              );
              continue;
            }
            log("BUTTON", "SUCCESS", "Upload button detected.");
          } catch (error) {
            log(
              "BUTTON",
              "FAIL",
              `Error locating the upload button: ${error.message}`
            );
            continue;
          }

          try {
            log(
              "BUTTON",
              "INFO",
              "Waiting for the upload button to become enabled..."
            );
            let buttonEnabled = false;
            for (let attempt = 0; attempt < 100; attempt++) {
              buttonEnabled = await page.evaluate((button) => {
                if (!button) return false;
                return (
                  window.getComputedStyle(button).opacity !== "0.5" &&
                  !button.disabled
                );
              }, uploadButton);

              if (buttonEnabled) {
                log(
                  "BUTTON",
                  "SUCCESS",
                  "Upload button is now enabled",
                  `Attempt: ${attempt + 1}/100`
                );
                break;
              }

              log(
                "BUTTON",
                "INFO",
                "Upload button is still disabled",
                `Retry: ${attempt + 1}/100`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            if (!buttonEnabled) {
              log(
                "BUTTON",
                "FAIL",
                "Upload button did not become enabled after retries. Skipping..."
              );
              continue;
            }
          } catch (error) {
            log(
              "BUTTON",
              "FAIL",
              `Error waiting for the upload button to become enabled: ${error.message}`
            );
            continue;
          }

          try {
            log("BUTTON", "INFO", "Clicking the upload button...");
            await uploadButton.click();
            log("BUTTON", "SUCCESS", "Upload button clicked successfully.");
          } catch (error) {
            log(
              "BUTTON",
              "FAIL",
              `Error clicking the upload button: ${error.message}`
            );
            continue;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));

          log("CLEANUP", "START", "Removing uploaded file");
          try {
            const removeButton = await page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll("button"));
              return (
                buttons.find(
                  (btn) => btn.textContent.trim() === "Remove file"
                ) || null
              );
            });

            const removeButtonExists = await page.evaluate(
              (button) => !!button,
              removeButton
            );

            if (removeButtonExists) {
              log(
                "REMOVE",
                "INFO",
                "'Remove file' button detected. Clicking..."
              );
              await removeButton.click();
              log(
                "REMOVE",
                "SUCCESS",
                "'Remove file' button clicked successfully."
              );
            }
          } catch (error) {
            log(
              "REMOVE",
              "FAIL",
              `Error with Remove file button: ${error.message}`
            );
            continue;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
          successfulUploads.push(image);
          log("FILE", "SUCCESS", `Completed processing ${image}`);
        } catch (error) {
          failedUploads.push(image);
          log("ERROR", "FAIL", `Failed processing ${image}: ${error.message}`);
          continue;
        }
      }
    }
  }

  await browser.close();
})();
