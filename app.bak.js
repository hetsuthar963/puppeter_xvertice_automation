const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const os = require("os");

const imagesDirectory = path.join(__dirname, "src");

const websiteUrl = "https://www.x-vertice.com";
const loginRoute = "/sign-in";
const uploadRoute = "/analysis";
const inputFileSelector = "#file-upload";

const userDataDir = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default"
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const waitForUserInput = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

// Helper function for delays
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadImages() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--start-maximized",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${userDataDir}`,
    ],
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const page = await browser.newPage();

  await page.goto(websiteUrl + uploadRoute);

  try {
    await page.waitForSelector(inputFileSelector, { timeout: 5000 });
    console.log("Already logged in, proceeding with uploads...");
  } catch (e) {
    await page.goto(websiteUrl + loginRoute);
    console.log("Please log in manually in the browser window.");

    await waitForUserInput(
      "Press Enter after you've successfully logged in..."
    );

    await page.goto(websiteUrl + uploadRoute);
    await page.waitForSelector(inputFileSelector);
  }

  console.log("Beginning uploads...");

  const images = fs
    .readdirSync(imagesDirectory)
    .filter((file) => file.endsWith(".jpg") || file.endsWith(".png"));

  for (let image of images) {
    const imagePath = path.join(imagesDirectory, image);
    console.log(`Uploading: ${image}`);

    // Upload the image
    const fileInput = await page.$(inputFileSelector);
    await fileInput.uploadFile(imagePath);

    // Wait for UI to update after file selection
    await delay(2000);

    // Find the upload button using the header as reference
    console.log(
      "Looking for upload button near 'Upload Your Document' header..."
    );

    try {
      // Find upload button using the header as context
      const uploadButton = await page.evaluateHandle(() => {
        // First find the header with "Upload Your Document" text
        const header = Array.from(document.querySelectorAll("h2")).find((h) =>
          h.textContent.includes("Upload Your Document")
        );

        if (!header) {
          console.log("Header not found");
          return null;
        }

        // Look for a button in the parent container or nearby
        let container = header.parentElement;

        // Try different levels of parent containers
        for (let i = 0; i < 3; i++) {
          // Look for button with exact "Upload" text first
          let button = Array.from(container.querySelectorAll("button")).find(
            (btn) => btn.textContent.trim() === "Upload"
          );

          if (button) return button;

          // If no match, go one level up in the DOM
          if (container.parentElement) {
            container = container.parentElement;
          } else {
            break;
          }
        }

        // Fallback to any button near the header
        return container.querySelector("button");
      });

      // Check if we found a button
      const isButtonValid = await page.evaluate((el) => {
        return el && el.tagName === "BUTTON";
      }, uploadButton);

      if (!isButtonValid) {
        console.log("Upload button not found near header!");
        continue;
      }

      console.log("Upload button found, waiting before clicking...");
      await delay(1000);

      // Click the button using direct method
      await uploadButton.click();
      console.log("Clicked upload button");

      // Wait for processing
      console.log("Waiting for processing to complete...");
      await delay(15000);
    } catch (error) {
      console.error("Error during button detection/clicking:", error.message);
      continue;
    }
  }

  console.log("All images uploaded successfully!");
  rl.close();
}

uploadImages().catch((err) => {
  console.error("Error:", err);
  rl.close();
});
