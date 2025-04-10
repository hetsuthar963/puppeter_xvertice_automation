const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const os = require('os');

const imagesDirectory = path.join(__dirname, 'src');

const websiteUrl = 'https://www.x-vertice.com';
const loginRoute = '/sign-in';
const uploadRoute = '/analysis';
const inputFileSelector = '#file-upload';

const userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const waitForUserInput = (prompt) => {
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer);
    });
  });
};

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadImages() {
    const browser = await puppeteer.launch({ 
        headless: false,
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            `--user-data-dir=${userDataDir}`
        ],
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });
    
    const page = await browser.newPage();

    await page.goto(websiteUrl + uploadRoute);
    
    try {
        await page.waitForSelector(inputFileSelector, { timeout: 5000 });
        console.log("Already logged in, proceeding with uploads...");
    } catch (e) {
        await page.goto(websiteUrl + loginRoute);
        console.log("Please log in manually in the browser window.");
        
        await waitForUserInput("Press Enter after you've successfully logged in...");
        
        await page.goto(websiteUrl + uploadRoute);
        await page.waitForSelector(inputFileSelector);
    }
    
    console.log("Beginning uploads...");

    const images = fs.readdirSync(imagesDirectory).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));

    // Cache for button references
    let cachedUploadButton = null;
    let isPageRefreshed = true; // Start with true to force initial button search
    
    for (let image of images) {
        const imagePath = path.join(imagesDirectory, image);
        console.log(`Uploading: ${image}`);

        // Make sure we're on the right page with file input available
        try {
            // Ensure we're on the correct page with file input
            console.log("Ensuring file input is available...");
            
            // Wait for the file input to be available
            await page.waitForSelector(inputFileSelector, { timeout: 10000 });
            
            // Retry if file input not found
            let fileInput = await page.$(inputFileSelector);
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!fileInput && retryCount < maxRetries) {
                console.log(`File input not found, retrying (${retryCount + 1}/${maxRetries})...`);
                await delay(2000);
                
                // Refresh the page if needed
                if (retryCount > 0) {
                    console.log("Refreshing page to recover...");
                    await page.goto(websiteUrl + uploadRoute);
                    await delay(2000);
                    
                    // Reset cached button
                    cachedUploadButton = null;
                    isPageRefreshed = true;
                }
                
                fileInput = await page.$(inputFileSelector);
                retryCount++;
            }
            
            if (!fileInput) {
                console.error("File input not found after multiple retries, skipping this file.");
                continue;
            }

            // Upload the image
            await fileInput.uploadFile(imagePath);
            
            // Wait for UI to update after file selection
            await delay(2000);
        } catch (fileInputError) {
            console.error("Error with file input:", fileInputError.message);
            console.log("Refreshing page to recover...");
            await page.goto(websiteUrl + uploadRoute);
            await delay(3000);
            cachedUploadButton = null;
            isPageRefreshed = true;
            continue;
        }
        
        try {
            // Only search for the upload button if we don't have a cached one or page was refreshed
            if (!cachedUploadButton || isPageRefreshed) {
                console.log("Looking for upload button...");
                
                // Find upload button using the header as context
                cachedUploadButton = await page.evaluateHandle(() => {
                    // First find the header with "Upload Your Document" text
                    const header = Array.from(document.querySelectorAll('h2')).find(
                        h => h.textContent.includes('Upload Your Document')
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
                        let button = Array.from(container.querySelectorAll('button')).find(
                            btn => btn.textContent.trim() === "Upload"
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
                    return container.querySelector('button');
                });
                
                // Reset the page refresh flag
                isPageRefreshed = false;
            } else {
                console.log("Using cached upload button...");
            }
            
            // Check if cached button is still valid
            const isButtonValid = await page.evaluate(el => {
                return el && el.tagName === 'BUTTON' && document.body.contains(el);
            }, cachedUploadButton);
            
            if (!isButtonValid) {
                console.log("Cached upload button is no longer valid, will find it again next iteration.");
                cachedUploadButton = null;
                
                // Refresh the page to get back to a clean state
                await page.goto(websiteUrl + uploadRoute);
                await delay(3000);
                isPageRefreshed = true;
                continue;
            }
            
            console.log("Upload button found, waiting before clicking...");
            await delay(1000);
            
            // Click the button using direct method
            await cachedUploadButton.click();
            console.log("Clicked upload button");
            
            // Wait for processing
            console.log("Waiting for processing to complete...");
            await delay(10000);
            console.log("process done: " + imagePath )
            
            // Now find and click the "Remove file" button
            console.log("Looking for 'Remove file' button...");
            
            try {
                const removeButton = await page.evaluateHandle(() => {
                    // Looking for a button with exact "Remove file" text
                    const buttons = Array.from(document.querySelectorAll('button'));
                    let button = buttons.find(btn => btn.textContent.trim() === "Remove file");
                    
                    if (button) return button;
                    
                    // If not found, try similar text variations
                    button = buttons.find(btn => 
                        btn.textContent.toLowerCase().includes("remove file") || 
                        btn.textContent.toLowerCase().includes("remove") || 
                        btn.textContent.toLowerCase().includes("delete file")
                    );
                    
                    return button || null;
                });
                
                // Check if we found the remove button
                const isRemoveButtonValid = await page.evaluate(el => {
                    return el && el.tagName === 'BUTTON';
                }, removeButton);
                
                if (isRemoveButtonValid) {
                    console.log("Remove file button found, waiting before clicking...");
                    await delay(1000);
                    
                    // Click the remove button
                    await removeButton.click();
                    console.log("Clicked remove file button");
                    
                    // Wait for removal to complete
                    await delay(3000);
                } else {
                    console.log("Remove file button not found, refreshing page...");
                    await page.reload();
                    await page.waitForSelector(inputFileSelector);
                    await delay(2000);
                    
                    // Reset cached button since page was refreshed
                    cachedUploadButton = null;
                    isPageRefreshed = true;
                }
            } catch (removeError) {
                console.error("Error during file removal:", removeError.message);
                // Refresh page as fallback
                await page.reload();
                await page.waitForSelector(inputFileSelector);
                await delay(2000);
                
                // Reset cached button since page was refreshed
                cachedUploadButton = null;
                isPageRefreshed = true;
            }
            
        } catch (error) {
            console.error("Error during button detection/clicking:", error.message);
            cachedUploadButton = null; // Reset on error
            continue;
        }
    }

    console.log('All images uploaded successfully!' + images.length);
    
    rl.close();
}

uploadImages().catch(err => {
    console.error('Error:', err);
    rl.close();
});