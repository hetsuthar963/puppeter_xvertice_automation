// const puppeteer = require('puppeteer');
// const path = require('path');
// const fs = require('fs');
// const readline = require('readline');
// const os = require('os');

// // Path to your images directory
// const imagesDirectory = path.join(__dirname, 'src');

// // Your website URL
// const websiteUrl = 'https://www.x-vertice.com';
// const loginRoute = '/sign-in';
// const uploadRoute = '/analysis';
// const inputFileSelector = '#file-upload';

// // Use your actual Chrome user profile instead of a test directory
// const userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default');

// // Create readline interface for user input
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// // Promise-based wait for user input
// const waitForUserInput = (prompt) => {
//   return new Promise(resolve => {
//     rl.question(prompt, answer => {
//       resolve(answer);
//     });
//   });
// };

// async function uploadImages() {
//     // Launch Chrome browser with user data directory
//     const browser = await puppeteer.launch({ 
//         headless: false,
//         args: [
//             '--start-maximized',
//             '--no-sandbox',
//             '--disable-dev-shm-usage',
//             `--user-data-dir=${userDataDir}`
//         ],
//         executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Path to Chrome on Mac
//     });
    
//     const page = await browser.newPage();

//     // Go directly to upload page (skip login if already logged in)
//     await page.goto(websiteUrl + uploadRoute);
    
//     try {
//         // Check if we need to login
//         await page.waitForSelector(inputFileSelector, { timeout: 5000 });
//         console.log("Already logged in, proceeding with uploads...");
//     } catch (e) {
//         // If not logged in, navigate to login page
//         await page.goto(websiteUrl + loginRoute);
//         console.log("Please log in manually in the browser window.");
        
//         // Wait for user to confirm they've logged in
//         await waitForUserInput("Press Enter after you've successfully logged in...");
        
//         // Now navigate to the upload route
//         await page.goto(websiteUrl + uploadRoute);
//         await page.waitForSelector(inputFileSelector);
//     }
    
//     console.log("Beginning uploads...");

//     // Rest of your code remains the same...

//     // Read all images from the src directory
//     const images = fs.readdirSync(imagesDirectory).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));

//     for (let image of images) {
//         const imagePath = path.join(imagesDirectory, image);
//         console.log(`Uploading: ${image}`);

//         // Upload the image
//         const fileInput = await page.$(inputFileSelector);
//         await fileInput.uploadFile(imagePath);

//         // Find the upload button by its text content
//         const uploadButton = await page.evaluate(() => {
//             // Get all buttons on the page
//             const buttons = Array.from(document.querySelectorAll('button'));
//             // Find the button with "Upload" text
//             return buttons.find(button => button.textContent.trim() === "Upload");
//         });
        
//         if (!uploadButton) {
//             console.log("Upload button not found!");
//             continue;
//         }
        
//         // Click the found upload button
//         await page.waitForTimeout(500)
//         await page.evaluate(button => button.click(), uploadButton);
        
//         // Wait for the analysis to complete
//         // await page.waitForSelector('#analysis-complete'); // Replace with appropriate selector
//         // console.log(`Uploaded and analyzed: ${image}`);

//         // Optional: You can add a delay between uploads if needed
//         await page.waitForTimeout(10000); // 10 seconds delay between uploads
//     }

//     console.log('All images uploaded successfully!');
//     // await browser.close();
//     rl.close(); // Close readline interface
// }

// // Run the upload process
// uploadImages().catch(err => {
//     console.error('Error:', err);
//     rl.close();
// });

// best one
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

    for (let image of images) {
        const imagePath = path.join(imagesDirectory, image);
        console.log(`Uploading: ${image}`);

        const fileInput = await page.$(inputFileSelector);
        await fileInput.uploadFile(imagePath);

        const uploadButton = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(button => button.textContent.trim() === "Upload");
        });
        
        if (!uploadButton) {
            console.log("Upload button not found!");
            continue;
        }
        
        await page.waitForTimeout(500)
        await page.evaluate(button => button.click(), uploadButton);
        
        await page.waitForTimeout(10000);
    }

    console.log('All images uploaded successfully!');
    rl.close();
}

uploadImages().catch(err => {
    console.error('Error:', err);
    rl.close();
});
// const puppeteer = require('puppeteer');
// const path = require('path');
// const fs = require('fs');
// const readline = require('readline');
// const os = require('os');

// const imagesDirectory = path.join(__dirname, 'src');

// const websiteUrl = 'https://www.x-vertice.com';
// const loginRoute = '/sign-in';
// const uploadRoute = '/analysis';
// const inputFileSelector = '#file-upload';

// const userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default');

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// const waitForUserInput = (prompt) => {
//   return new Promise(resolve => {
//     rl.question(prompt, answer => {
//       resolve(answer);
//     });
//   });
// };

// async function uploadImages() {
//     const browser = await puppeteer.launch({ 
//         headless: false,
//         args: [
//             '--start-maximized',
//             '--no-sandbox',
//             '--disable-dev-shm-usage',
//             `--user-data-dir=${userDataDir}`
//         ],
//         executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
//     });
    
//     const page = await browser.newPage();

//     await page.goto(websiteUrl + uploadRoute);
    
//     try {
//         await page.waitForSelector(inputFileSelector, { timeout: 5000 });
//         console.log("Already logged in, proceeding with uploads...");
//     } catch (e) {
//         await page.goto(websiteUrl + loginRoute);
//         console.log("Please log in manually in the browser window.");
        
//         await waitForUserInput("Press Enter after you've successfully logged in...");
        
//         await page.goto(websiteUrl + uploadRoute);
//         await page.waitForSelector(inputFileSelector);
//     }
    
//     console.log("Beginning uploads...");

//     const images = fs.readdirSync(imagesDirectory).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));

//     for (let image of images) {
//         const imagePath = path.join(imagesDirectory, image);
//         console.log(`Uploading: ${image}`);

//         const fileInput = await page.$(inputFileSelector);
//         await fileInput.uploadFile(imagePath);

//         await page.waitForTimeout(500);
//         const uploadButton = await page.evaluate(() => {
//             const buttons = Array.from(document.querySelectorAll('button'));
//             return buttons.find(button => button.textContent.trim() === "Upload");
//         });
        
//         if (!uploadButton) {
//             console.log("Upload button not found!");
//             continue;
//         }
        
//         await page.waitForTimeout(500);
//         await page.evaluate(button => button.click(), uploadButton);
        
//         await page.waitForTimeout(10000);
        
//         // Find and click the remove file button
//         try {
//             const removeButton = await page.evaluate(() => {
//                 // Try multiple approaches to find the remove button
                
//                 // Look for buttons with "remove"/"delete" text
//                 const buttons = Array.from(document.querySelectorAll('button'));
//                 let button = buttons.find(btn => 
//                     btn.textContent.toLowerCase().includes('remove') || 
//                     btn.textContent.toLowerCase().includes('delete') || 
//                     btn.textContent.toLowerCase().includes('clear')
//                 );
//                 if (button) return button;
                
//                 // Look for buttons with X icon or close symbols
//                 button = buttons.find(btn => 
//                     btn.textContent.includes('×') || 
//                     btn.textContent.includes('✕') || 
//                     btn.textContent.includes('✖')
//                 );
//                 if (button) return button;
                
//                 // Look for buttons near the file input or preview
//                 const fileInput = document.querySelector('#file-upload');
//                 if (fileInput) {
//                     // Get parent container
//                     const parent = fileInput.parentElement;
//                     if (parent) {
//                         // Look for buttons in the parent or sibling elements
//                         const nearbyButtons = Array.from(parent.querySelectorAll('button'));
//                         if (nearbyButtons.length > 0) return nearbyButtons[0];
//                     }
//                 }
                
//                 return null;
//             });
            
//             if (removeButton) {
//                 console.log("Removing file before next upload...");
//                 await page.evaluate(button => button.click(), removeButton);
//                 await page.waitForTimeout(2000); // Wait for removal to complete
//             } else {
//                 console.log("Remove button not found, continuing with next upload...");
//                 // As a fallback, refresh the page to clear the current file
//                 await page.reload();
//                 await page.waitForSelector(inputFileSelector);
//                 await page.waitForTimeout(2000);
//             }
//         } catch (error) {
//             console.log("Error removing file:", error.message);
//             // As a fallback, refresh the page to clear the current file
//             await page.reload();
//             await page.waitForSelector(inputFileSelector);
//             await page.waitForTimeout(2000);
//         }
//     }

//     console.log('All images uploaded successfully!');
//     rl.close();
// }

// uploadImages().catch(err => {
//     console.error('Error:', err);
//     rl.close();
// });