// Ap Kara Command Handler for Baileys Bot
// Extracts data from replied message using pattern matching
import axios from 'axios';
import express from 'express';
import fs from 'fs';

import { loadEnvFile } from 'node:process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  loadEnvFile(join(__dirname, '../.env'));
} catch (err) {
  console.error("Could not find .env file one level up.");
}

// Create Express server to receive messages from Python
const app = express();
app.use(express.json());

// Store the WhatsApp socket globally so we can use it in routes
let globalSock = null;

// Store message contexts for replies
const messageContexts = new Map();

// Queue system for processing requests
const requestQueue = [];
let isProcessing = false;

// Queue status tracking
const queueStatus = {
    totalProcessed: 0,
    currentPosition: 0,
    lastProcessedAt: null
};

// Process queue function
async function processQueue() {
    if (isProcessing || requestQueue.length === 0) {
        return;
    }

    isProcessing = true;
    console.log(`🔄 Starting queue processing. Queue length: ${requestQueue.length}`);

    while (requestQueue.length > 0) {
        const request = requestQueue.shift();
        queueStatus.currentPosition++;
        
        console.log(`⏳ Processing request ${queueStatus.currentPosition} - From: ${request.chatId}`);
        
        try {
            // Don't send processing status to user - removed as requested
            // Just process directly without additional messages

            // Send data to Python
            await sendToPython(request.finalData, request.chatId, request.originalMessage);
            
            queueStatus.totalProcessed++;
            queueStatus.lastProcessedAt = new Date().toISOString();
            
            console.log(`✅ Completed request ${queueStatus.currentPosition}`);
            
            // Small delay between requests to prevent system overload
            if (requestQueue.length > 0) {
                console.log(`⏸️ Waiting 10 seconds before next request...`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
            }
            
        } catch (error) {
            console.error(`❌ Error processing request ${queueStatus.currentPosition}:`, error);
            
            // Send error message to user
            if (globalSock && request.chatId) {
                await globalSock.sendMessage(request.chatId, {
                    text: `❌ *Processing Failed*\n\nRequest #${queueStatus.currentPosition} failed to process.\n\nError: ${error.message || 'Unknown error'}\n\n🔄 You can try again with a new "ap kara" command.`
                }, { quoted: request.originalMessage });
            }
        }
    }

    isProcessing = false;
    console.log(`✅ Queue processing completed. Total processed: ${queueStatus.totalProcessed}`);
}

// Add request to queue
function addToQueue(chatId, finalData, originalMessage, sock) {
    const queueItem = {
        id: Date.now() + Math.random(), // Unique ID
        chatId: chatId,
        finalData: finalData,
        originalMessage: originalMessage,
        addedAt: new Date().toISOString(),
        sock: sock
    };
    
    requestQueue.push(queueItem);
    console.log(`➕ Added request to queue. Queue length: ${requestQueue.length}`);
    
    // Calculate position in queue (0-indexed)
    // If processing is active, current items are: [being processed] + [item1, item2, ...]
    // If not processing, items are: [item1, item2, ...]
    let queuePosition;
    if (isProcessing) {
        // There's one item being processed, so new items start from position 0, 1, 2...
        queuePosition = requestQueue.length - 1;
    } else {
        // No processing happening, so first item is position 0
        queuePosition = requestQueue.length - 1;
    }
    
    return queuePosition;
}

// Get queue status
function getQueueStatus() {
    return {
        ...queueStatus,
        queueLength: requestQueue.length,
        isProcessing: isProcessing,
        nextRequest: requestQueue.length > 0 ? {
            chatId: requestQueue[0].chatId,
            addedAt: requestQueue[0].addedAt
        } : null
    };
}

// Periodic cleanup function for message contexts
function cleanupOldContexts() {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [key, context] of messageContexts.entries()) {
        if (context.timestamp < twentyFourHoursAgo) {
            messageContexts.delete(key);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old message contexts`);
    }
}

// Run cleanup every 6 hours
setInterval(cleanupOldContexts, 6 * 60 * 60 * 1000);

// CONFIGURATION: Phone number to send screenshot to (format: countrycode + number without +)
const SCREENSHOT_RECIPIENT = `91${process.env.SS_RECIPIENT_NUM}@s.whatsapp.net`; // Replace with actual number
const SCREENSHOT_PATH = '/home/ubuntu/whatsapp-bot/details.png';

// Helper function to convert all data to uppercase
function convertDataToUppercase(data) {
    const result = { ...data };
    for (const key in result) {
        if (result[key] && typeof result[key] === 'string') {
            result[key] = result[key].toUpperCase();
        }
    }
    return result;
}

// Helper function to validate required fields
function validateRequiredFields(data) {
    const requiredFields = ['phone_num', 'driver_name', 'driver_license', 'vehicle_num', 'weight', 'so_no'];
    const missingFields = [];
    
    for (const field of requiredFields) {
        if (!data[field] || data[field] === null || data[field] === undefined || data[field].trim() === '') {
            missingFields.push(field);
        }
    }
    
    return missingFields;
}

// Helper function to format field names for user-friendly display
function formatFieldName(fieldName) {
    const fieldMap = {
        'phone_num': 'Phone Number',
        'driver_name': 'Driver Name',
        'driver_license': 'Driver License',
        'vehicle_num': 'Vehicle Number',
        'weight': 'Weight',
        'so_no': 'SO Number'
    };
    return fieldMap[fieldName] || fieldName;
}

// Pattern definitions for data extraction
const dataPatterns = {
    // Vehicle number: xx11xx1111 format (2 letters, 2 digits, 2 letters, 4 digits)
    vehicleNumber: /\b[A-Za-z]{2}\d{1,2}[A-Za-z]{1,2}\d{3,4}\b/,
    
    // SO Number: 10-digit number starting with 0-3
    soNumber: /\b[0-3]\d{9}\b/,
    
    // Phone Number: 10-digit number starting with 4-9
    phoneNumber: /\b[4-9]\d{9}\b/,
    
    // Weight: number followed by "MT" (exact match)
    weight: /\b(\d+(?:\.\d+)?)\s*MT\b/i,
    
    // Destination: string before weight (number + MT) in the same line
    destinationBeforeWeight: /^(.*?)\s+\d+(?:\.\d+)?\s*MT\b/i,
    
    // Driver license last 4 digits
    driverLicense: /\b\d{4}\b/
};

// Product mapping patterns (case insensitive)
const PRODUCT_MAPPINGS = [
    {
        productName: "N 40 KG MAHADHAN CROPTEK 9:24:24",
        patterns: [
            /\b(n|c)\s*-?\s*9\b/i,
            /\b(croptek\s*)?n\s*9\b/i,
            /\b9\s*[:\-.\s]\s*24\s*[:\-.\s]\s*24\b/i,
            /\b92424\b/i,
            /\bc\s*-?\s*9\s*-?\s*24\s*-?\s*24\b/i
        ]
    },
    {
        productName: "N 50 KG MAHADHAN SMARTEK NPKS 20:20:0:13",
        patterns: [
            /\b(smartek\s*)?s\s*-?\s*20\b/i,
            /\b20\s*[:\-.\s]\s*20\s*[:\-.\s]\s*0\s*[:\-.\s]\s*13\b/i,
            /\b2020013\b/i,
            /\bs\s*-?\s*20\s*-?\s*20\s*-?\s*0\s*-?\s*13\b/i
        ]
    },
    {
        productName: "N 50 KG MAHADHAN 24:24:0",
        patterns: [
            /\b24\s*[:\-.\s]\s*24\s*[:\-.\s]\s*0\b/i,
            /\b24240\b/i
        ]
    },
    {
        productName: "N 40 KG MAHADHAN CROPTEK NPK 11:30:14",
        patterns: [
            /\b(n|c)\s*-?\s*11\b/i,
            /\b11\s*[:\-.\s]\s*30\s*[:\-.\s]\s*14\b/i,
            /\b113014\b/i
        ]
    },
    {
        productName: "N 40 KG MAHADHAN CROPTEK NPK 8:21:21",
        patterns: [
            /\b(n|c)\s*-?\s*8\b/i,
            /\b8\s*[:\-.\s]\s*21\s*[:\-.\s]\s*21\b/i,
            /\b82121\b/i,
            /\b(c|n)\s*-?\s*8\s*-?\s*21\s*-?\s*21\b/i
        ]
    },
    {
        productName: "N 50 KG MAHADHAN SMARTEK NPK 10:26:26",
        patterns: [
            /\b(smartek\s*)?s\s*-?\s*10\b/i,
            /\b10\s*[:\-.\s]\s*26\s*[:\-.\s]\s*26\b/i,
            /\b102626\b/i,
            /\b1026\b/i,
            /\b10\s*-?\s*26\b/i
        ]
    },
    {
        productName: "N 50 KG MAHADHAN SMARTEK NPKS 16:20:0:13",
        patterns: [
            /\b(smartek\s*)?s\s*-?\s*16\b/i,
            /\b16\s*[:\-.\s]\s*20\s*[:\-.\s]\s*0\s*[:\-.\s]\s*13\b/i,
            /\b1620013\b/i
        ]
    }
];

// Function to extract product type from message
function extractProductInfo(messageText) {
    if (!messageText) return null;
    
    console.log(`📦 Extracting product info from message:`, messageText);
    
    // Step 1: Extract known fields to identify and skip their lines
    const vehicleMatch = messageText.match(dataPatterns.vehicleNumber);
    const soMatch = messageText.match(dataPatterns.soNumber);
    const phoneMatch = messageText.match(dataPatterns.phoneNumber);
    const weightMatch = messageText.match(dataPatterns.weight);
    
    console.log(`📦 Known fields extracted:`, {
        vehicle: vehicleMatch ? vehicleMatch[0] : null,
        so: soMatch ? soMatch[0] : null,
        phone: phoneMatch ? phoneMatch[0] : null,
        weight: weightMatch ? weightMatch[1] : null
    });
    
    // Step 2: Split message into lines and find first line with numbers that's NOT a known field
    const lines = messageText.split('\n');
    let productLineText = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue; // Skip empty lines
        
        // Skip if this line contains any of the known field values
        if (vehicleMatch && trimmedLine.includes(vehicleMatch[0])) {
            console.log(`📦 Skipping vehicle line: ${trimmedLine}`);
            continue;
        }
        if (soMatch && trimmedLine.includes(soMatch[0])) {
            console.log(`📦 Skipping SO line: ${trimmedLine}`);
            continue;
        }
        if (phoneMatch && trimmedLine.includes(phoneMatch[0])) {
            console.log(`📦 Skipping phone line: ${trimmedLine}`);
            continue;
        }
        if (weightMatch && /\d+(?:\.\d+)?\s*MT\b/i.test(trimmedLine)) {
            console.log(`📦 Skipping weight line: ${trimmedLine}`);
            continue;
        }
        
        // Check if this line has any numbers (potential product line)
        if (/\d/.test(trimmedLine)) {
            productLineText = trimmedLine;
            console.log(`📦 Found product line candidate: ${trimmedLine}`);
            break; // Found it!
        }
    }
    
    if (!productLineText) {
        console.log(`📦 No product line found with numbers after skipping known fields`);
        return null;
    }
    
    // Step 3: Match against product mappings
    for (const mapping of PRODUCT_MAPPINGS) {
        for (const pattern of mapping.patterns) {
            if (pattern.test(productLineText)) {
                console.log(`📦 Matched pattern ${pattern} → ${mapping.productName}`);
                return mapping.productName;
            }
        }
    }
    
    console.log(`📦 No product mapping matched for: ${productLineText}`);
    return null;
}

// Pattern-based extraction
function extractDataFromMessage(messageText) {
    if (!messageText) return null;
    
    const result = {
        vehicle_num: null,
        destination: null,
        weight: null,
        so_no: null,
        phone_num: null,
        driver_license: null,
        driver_name: null
    };

    // Extract vehicle number
    const vehicleMatch = messageText.match(dataPatterns.vehicleNumber);
    if (vehicleMatch) {
        result.vehicle_num = vehicleMatch[0];
    }

    // Extract all 10-digit numbers
    const allTenDigitNumbers = messageText.match(/\b\d{10}\b/g) || [];
    
    for (const number of allTenDigitNumbers) {
        const firstDigit = number[0];
        
        // Phone number: starts with 4-9
        if (firstDigit >= '4' && firstDigit <= '9' && !result.phone_num) {
            result.phone_num = number;
        }
        // SO number: starts with 0-3
        else if (firstDigit >= '0' && firstDigit <= '3' && !result.so_no) {
            result.so_no = number;
        }
    }

    // Extract weight
    const weightMatch = messageText.match(dataPatterns.weight);
    if (weightMatch) {
        result.weight = weightMatch[1];
    }

    // Extract destination (string before weight in same line)
    const lines = messageText.split('\n');
    for (let line of lines) {
        if (line.match(dataPatterns.weight)) {
            const destMatch = line.match(dataPatterns.destinationBeforeWeight);
            if (destMatch) {
                // Remove vehicle number from beginning if present
                let destination = destMatch[1].trim();
                const vehicleMatch = destination.match(dataPatterns.vehicleNumber);
                if (vehicleMatch) {
                    destination = destination.replace(vehicleMatch[0], '').trim();
                }
                result.destination = destination;
                break;
            }
        }
    }

    return result;
}

// Line-based fallback extraction
function extractDataByLines(messageText) {
    const lines = messageText.split('\n').map(line => line.trim()).filter(line => line);

    const result = {
        vehicle_num: null,
        destination: null,
        weight: null,
        so_no: null,
        phone_num: null,
        driver_license: null,
        driver_name: null
    };

    // Check each line for patterns
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Vehicle number (usually first line)
        if (!result.vehicle_num) {
            const vehicleMatch = line.match(dataPatterns.vehicleNumber);
            if (vehicleMatch) {
                result.vehicle_num = vehicleMatch[0];
            }
        }
        
        // Extract all 10-digit numbers from the line
        const allTenDigitNumbers = line.match(/\b\d{10}\b/g) || [];
        
        for (const number of allTenDigitNumbers) {
            const firstDigit = number[0];
            
            // Phone number: starts with 4-9
            if (firstDigit >= '4' && firstDigit <= '9' && !result.phone_num) {
                result.phone_num = number;
            }
            // SO number: starts with 0-3
            else if (firstDigit >= '0' && firstDigit <= '3' && !result.so_no) {
                result.so_no = number;
            }
        }
        
        // Weight (number followed by MT)
        if (!result.weight) {
            const weightMatch = line.match(dataPatterns.weight);
            if (weightMatch) {
                result.weight = weightMatch[1]; // Extract just the number, not the full match
            }
        }

        // Weight and destination from same line
        const weightMatch = line.match(dataPatterns.weight);
        if (weightMatch && !result.weight) {
            result.weight = weightMatch[1]; // Fixed: Extract just the number
            
            // Extract destination from the same line (everything before the weight)
            if (!result.destination) {
                const destMatch = line.match(dataPatterns.destinationBeforeWeight);
                if (destMatch) {
                    let destination = destMatch[1].trim();
                    // Remove vehicle number from beginning if present
                    const vehicleMatch = destination.match(dataPatterns.vehicleNumber);
                    if (vehicleMatch) {
                        destination = destination.replace(vehicleMatch[0], '').trim();
                    }
                    result.destination = destination;
                }
            }
        }
    }

    return result;
}

// New function to extract driver info from ap kara command
function extractDriverInfo(messageText) {
    const lines = messageText.split('\n').map(line => line.trim()).filter(line => line);
    
    const result = {
        driver_name: null,
        driver_license: null,
        additional_data: {
            vehicle_num: null,
            destination: null,
            weight: null,
            so_no: null,
            phone_num: null
        }
    };

    // Skip the first line (ap kara command)
    if (lines.length < 2) return result;

    // Second line should contain driver name and license
    const driverLine = lines[1];
    
    // Find 4-digit number (driver license)
    const licenseMatch = driverLine.match(dataPatterns.driverLicense);
    if (licenseMatch) {
        result.driver_license = licenseMatch[0];
        
        // Extract driver name (everything before the 4 digits)
        let nameBeforeLicense = driverLine.substring(0, driverLine.indexOf(licenseMatch[0])).trim();
        
        // Remove trailing hyphen if present
        if (nameBeforeLicense.endsWith('-')) {
            nameBeforeLicense = nameBeforeLicense.slice(0, -1).trim();
        }
        
        if (nameBeforeLicense) {
            result.driver_name = nameBeforeLicense;
        }
        
        // Extract additional text after the 4 digits
        const textAfterLicense = driverLine.substring(driverLine.indexOf(licenseMatch[0]) + 4).trim();
        
        // If there's more text after the license, combine it with remaining lines for data extraction
        let additionalText = textAfterLicense;
        if (lines.length > 2) {
            additionalText += '\n' + lines.slice(2).join('\n');
        }
        
        if (additionalText.trim()) {
            // Extract data from additional text using existing patterns
            const additionalData = extractDataFromMessage(additionalText);
            result.additional_data = additionalData;
        }
    }

    return result;
}

// NEW: Function to send screenshot to specific number
async function sendScreenshotToRecipient(processedData) {
    try {
        // Check if screenshot file exists
        if (!fs.existsSync(SCREENSHOT_PATH)) {
            console.error('❌ Screenshot file not found:', SCREENSHOT_PATH);
            return false;
        }

        if (!globalSock) {
            console.error('❌ WhatsApp socket not available for screenshot');
            return false;
        }

        // Read the screenshot file
        const imageBuffer = fs.readFileSync(SCREENSHOT_PATH);

        // Send screenshot to recipient without any caption
        await globalSock.sendMessage(SCREENSHOT_RECIPIENT, {
            image: imageBuffer
        });

        console.log('✅ Screenshot sent to recipient:', SCREENSHOT_RECIPIENT);
        return true;

    } catch (error) {
        console.error('❌ Error sending screenshot to recipient:', error);
        return false;
    }
}

// Modified function to send data to Python with callback info and handle success/error responses
async function sendToPython(finalData, chatId, originalMessage) {
    try {
        const pythonData = {
            driver_name: finalData.driver_name || null,
            driver_license: finalData.driver_license || null,
            vehicle_num: finalData.vehicle_num || null,
            destination: finalData.destination || null,
            weight: finalData.weight || null,
            so_no: finalData.so_no || null,
            phone_num: finalData.phone_num || null,
            product_type: finalData.product_type || null,
            chat_id: chatId, // Send chat ID so Python knows where to reply
            message_key: originalMessage.key // Send message key for replies
        };

        // Store message context for replies
        messageContexts.set(chatId, {
            messageKey: originalMessage.key,
            originalMessage: originalMessage,
            timestamp: Date.now()
        });

        console.log(`💾 Stored message context for ${chatId}:`, originalMessage.key);

        console.log('Sending data to Python...', JSON.stringify(pythonData, null, 2));
        
        const response = await axios.post('http://localhost:5000/process-data', pythonData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 300000  // 5 minutes timeout (was 30 seconds)
        });

        console.log('✅ Python response:', response.data);

        // Handle successful response from Python
        if (response.data && response.data.status === 'success') {
            // Send success message as reply to the original ap kara message
            if (globalSock && chatId) {                const processedData = response.data.processed_data || finalData;
                
                // Compare requested vs actual quantity
                const requestedWeight = parseFloat(finalData.weight);
                const actualWeight = parseFloat(processedData.actual_quantity || processedData.weight || finalData.weight);
                
                let successMessage;
                
                // Check if quantities match (allowing small floating point differences)
                if (Math.abs(requestedWeight - actualWeight) < 0.01) {
                    // Quantities match - just send "Done"
                    successMessage = 'Done ✅';
                } else {
                    // Quantities don't match - show actual vs requested
                    successMessage = `AP done for ${actualWeight} MT to load ${requestedWeight} MT ✅`;
                }
                //if (processedData) {
                  //  if (processedData.driver_name) {
                    //    successMessage += `👤 Driver Name: ${processedData.driver_name}\n`;
                    //}
                    //if (processedData.driver_license) {
                      //  successMessage += `🆔 License: ${processedData.driver_license}\n`;
                    //}
                    //if (processedData.vehicle_num) {
                      //  successMessage += `🚛 Vehicle: ${processedData.vehicle_num}\n`;
                    //}
                    //if (processedData.destination) {
                      //  successMessage += `📍 Destination: ${processedData.destination}\n`;
                    //}
                    //if (processedData.weight) {
                      //  successMessage += `⚖️ Weight: ${processedData.weight} MT\n`;
                    //}
                    //if (processedData.so_no) {
                       // successMessage += `📋 SO Number: ${processedData.so_no}\n`;
                    //}
                    //if (processedData.phone_num) {
                      //  successMessage += `📞 Phone: ${processedData.phone_num}\n`;
                    //}
                //}
                
                //successMessage += '\n🎉 All processes executed successfully!';

                await globalSock.sendMessage(chatId, { 
                    text: successMessage
                }, { 
                    quoted: originalMessage
                });
                
                console.log('✅ Success message sent to WhatsApp');

                // NEW: Send screenshot to specific recipient
                const screenshotSent = await sendScreenshotToRecipient(processedData);
                if (screenshotSent) {
                    console.log('✅ Screenshot notification sent to recipient');
                } else {
                    console.log('⚠️ Screenshot notification was not sent');
                }
            }
        }

        return response.data;

    } catch (error) {
        console.error('❌ Error sending to Python:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        // Handle error responses from Python
        if (globalSock && chatId) {
            let errorMessage = '❌ *Processing Failed*\n\n';
            
            // Extract the specific error message from Python if available
            if (error.response?.data?.status === 'error') {
                errorMessage += `*Error:* ${error.response.data.message}`;
            } else if (error.response?.data?.error) {
                errorMessage += `*Error:* ${error.response.data.error}`;
            } else {
                const genericError = error.message || 'An unexpected error occurred while processing your request.';
                errorMessage += `*Error:* ${genericError}`;
            }
            
            //errorMessage += '\n\n🔄 Please check the screenshot below for the exact failure point.';

            // Path provided: /home/ubuntu/whatsapp-bot/error_ss.png
            const ERROR_SS_PATH = '/home/ubuntu/whatsapp-bot/error_ss.png';

            if (fs.existsSync(ERROR_SS_PATH)) {
                try {
                    // 1. Read the screenshot
                    const imageBuffer = fs.readFileSync(ERROR_SS_PATH);

                    // 2. Send as Image with Caption
                    await globalSock.sendMessage(chatId, {
                        image: imageBuffer,
                        caption: errorMessage
                    }, { 
                        quoted: originalMessage 
                    });

                    console.log('📸 Error screenshot sent successfully.');

                    // 3. Delete the file after sending
                    fs.unlinkSync(ERROR_SS_PATH);
                    console.log('🧹 Error screenshot deleted from server.');

                } catch (ssSendError) {
                    console.error('⚠️ Failed to send or delete screenshot:', ssSendError);
                    // Fallback to text if image sending fails
                    await globalSock.sendMessage(chatId, { text: errorMessage }, { quoted: originalMessage });
                }
            } else {
                // No screenshot found, send just the text error
                await globalSock.sendMessage(chatId, { text: errorMessage }, { quoted: originalMessage });
                console.log('ℹ️ No error screenshot found at path, sent text-only message.');
            }
        }
        
        return null;
    }
}

// MODIFIED: Route to receive messages from Python with reply functionality
app.post('/send-message', async (req, res) => {
    try {
        const { chat_id, message, message_type = 'text', reply_to_original = false } = req.body;
        
        if (!chat_id || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'chat_id and message are required' 
            });
        }

        if (!globalSock) {
            return res.status(500).json({ 
                success: false, 
                error: 'WhatsApp socket not available' 
            });
        }

        // Prepare message payload
        let messagePayload;
        
        if (message_type === 'text') {
            messagePayload = { text: message };
        } else if (message_type === 'image') {
            // Handle image messages if needed
            messagePayload = { 
                image: { url: message.url }, 
                caption: message.caption || '' 
            };
        }

        // Add reply context if requested and available
        if (reply_to_original) {
            const messageContext = messageContexts.get(chat_id);
            if (messageContext && messageContext.messageKey) {
                messagePayload.quoted = messageContext.messageKey;
                console.log(`📎 Adding reply context for ${chat_id}:`, messageContext.messageKey);
            } else {
                console.log(`⚠️ No message context found for ${chat_id} or missing messageKey`);
            }
        }

        await globalSock.sendMessage(chat_id, messagePayload);
        
        console.log(`✅ Message sent to ${chat_id}${reply_to_original ? ' (as reply)' : ''}: ${message}`);
        
        res.json({ 
            success: true, 
            message: 'Message sent successfully' 
        });

    } catch (error) {
        console.error('❌ Error sending message from Python:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// MODIFIED: Route for Python to send status updates with reply functionality
app.post('/send-status', async (req, res) => {
    try {
        const { chat_id, status, data, reply_to_original = true } = req.body;
        
        if (!chat_id || !status) {
            return res.status(400).json({ 
                success: false, 
                error: 'chat_id and status are required' 
            });
        }

        if (!globalSock) {
            return res.status(500).json({ 
                success: false, 
                error: 'WhatsApp socket not available' 
            });
        }

        let statusMessage = '';
        
        switch (status) {
            case 'processing':
                statusMessage = '⏳ Processing your data...';
                break;
            case 'completed':
                statusMessage = '✅ Processing completed successfully!';
                if (data && data.result) {
                    statusMessage += `\n\n📊 *Result:*\n${data.result}`;
                }
                break;
            case 'error':
                statusMessage = '❌ An error occurred during processing';
                if (data && data.error) {
                    statusMessage += `\n\n*Error:* ${data.error}`;
                }
                break;
            case 'custom':
                statusMessage = data && data.message ? data.message : 'Status update';
                break;
            default:
                statusMessage = `📋 Status: ${status}`;
        }

        // Prepare message payload
        let messagePayload = { text: statusMessage };

        // Add reply context if requested and available
        if (reply_to_original) {
            const messageContext = messageContexts.get(chat_id);
            if (messageContext && messageContext.messageKey) {
                messagePayload.quoted = messageContext.messageKey;
                console.log(`📎 Adding reply context for ${chat_id}:`, messageContext.messageKey);
            } else {
                console.log(`⚠️ No message context found for ${chat_id} or missing messageKey`);
            }
        }

        await globalSock.sendMessage(chat_id, messagePayload);
        
        console.log(`✅ Status sent to ${chat_id}${reply_to_original ? ' (as reply)' : ''}: ${status}`);
         // Clean up old message contexts (older than 24 hours)
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        for (const [key, context] of messageContexts.entries()) {
            if (context.timestamp < twentyFourHoursAgo) {
                messageContexts.delete(key);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Status sent successfully' 
        });

    } catch (error) {
        console.error('❌ Error sending status from Python:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// NEW: Route to get queue status
app.get('/queue-status', async (req, res) => {
    try {
        const status = getQueueStatus();
        res.json({ 
            success: true, 
            status: status
        });
    } catch (error) {
        console.error('❌ Error getting queue status:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// NEW: Route to clear queue (admin function)
app.post('/clear-queue', async (req, res) => {
    try {
        const clearedCount = requestQueue.length;
        requestQueue.length = 0; // Clear the array
        isProcessing = false;
        
        console.log(`🧹 Queue cleared. Removed ${clearedCount} requests`);
        
        res.json({ 
            success: true, 
            message: `Queue cleared. Removed ${clearedCount} requests`,
            clearedCount: clearedCount
        });
    } catch (error) {
        console.error('❌ Error clearing queue:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// NEW: Route to clear message context (optional cleanup)
app.post('/clear-context', async (req, res) => {
    try {
        const { chat_id } = req.body;
        
        if (chat_id) {
            messageContexts.delete(chat_id);
            console.log(`🧹 Cleared message context for ${chat_id}`);
        } else {
            messageContexts.clear();
            console.log('🧹 Cleared all message contexts');
        }
        
        res.json({ 
            success: true, 
            message: 'Context cleared successfully' 
        });

    } catch (error) {
        console.error('❌ Error clearing context:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Main Ap Kara handler (modified to store message context for replies)
async function handleApKaraCommand(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        const messageKey = message.key;
        
        // Check if message is from a group
        if (!chatId.endsWith('@g.us')) {
            console.log('❌ Ap kara command ignored: Not from a group');
            return;
        }

        // Get group metadata to check group name
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const groupName = groupMetadata.subject;
            
            if (groupName !== "Test") {
                console.log(`❌ Ap kara command ignored: Group "${groupName}" is not "Test"`);
                return;
            }
            
            console.log(`✅ Ap kara command accepted from group: "${groupName}"`);
        } catch (groupError) {
            console.error('❌ Error getting group metadata:', groupError);
            return;
        }
        
        // Store the original message for reply context
        messageContexts.set(chatId, {
            messageKey: messageKey,
            originalMessage: message.message,
            timestamp: Date.now()
        });
        
        // Don't send initial processing message - removed as requested

        // Get message text directly from the current message (not quoted)
        let messageText = '';
        if (message.message.conversation) {
            messageText = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
            messageText = message.message.extendedTextMessage.text;
        }

        if (!messageText) {
            await sock.sendMessage(chatId, {
                text: "❌ Could not extract text from the message",
                quoted: message
            });
            return;
        }

        let finalData = {
            vehicle_num: null,
            destination: null,
            weight: null,
            so_no: null,
            phone_num: null,
            driver_license: null,
            driver_name: null,
            product_type: null
        };

        // Extract product information from the message text
        let productInfo = null;
        
        // Check quoted message for product first
        const quotedMessageForProduct = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessageForProduct) {
            let quotedText = '';
            if (quotedMessageForProduct.conversation) {
                quotedText = quotedMessageForProduct.conversation;
            } else if (quotedMessageForProduct.extendedTextMessage?.text) {
                quotedText = quotedMessageForProduct.extendedTextMessage.text;
            }
            
            if (quotedText) {
                productInfo = extractProductInfo(quotedText);
                if (productInfo) {
                    finalData.product_type = productInfo;
                    console.log('📦 Product info extracted from quoted message:', productInfo);
                }
            }
        }
        
        // Check if this is an "ap kara" command with driver info
        if (messageText.toLowerCase().trim().startsWith('ap kara')) {
            // This should be a reply to the original message with the 4 variables
            const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!quotedMessage) {
                await sock.sendMessage(chatId, {
                    text: "❌ Please reply to a message with 'ap kara' command",
                    quoted: message
                });
                return;
            }

            // Extract text from the ORIGINAL quoted message first
            let quotedText = '';
            if (quotedMessage.conversation) {
                quotedText = quotedMessage.conversation;
            } else if (quotedMessage.extendedTextMessage?.text) {
                quotedText = quotedMessage.extendedTextMessage.text;
            }

            if (!quotedText) {
                await sock.sendMessage(chatId, {
                    text: "❌ Could not extract text from the original message",
                    quoted: message
                });
                return;
            }

            // First, extract data from the ORIGINAL message
            const originalData = extractDataFromMessage(quotedText);
            const originalLineBasedData = extractDataByLines(quotedText);

            // Merge original data (prefer pattern-based, fallback to line-based)
            finalData = {
                vehicle_num: originalData.vehicle_num || originalLineBasedData.vehicle_num || null,
                destination: originalData.destination || originalLineBasedData.destination || null,
                weight: originalData.weight || originalLineBasedData.weight || null,
                so_no: originalData.so_no || originalLineBasedData.so_no || null,
                phone_num: originalData.phone_num || originalLineBasedData.phone_num || null,
                driver_license: null,
                driver_name: null,
                product_type: finalData.product_type
            };

            // Then, extract driver info from the ap kara reply
            const driverInfo = extractDriverInfo(messageText);
            
            if (driverInfo.driver_name || driverInfo.driver_license) {
                finalData.driver_name = driverInfo.driver_name;
                finalData.driver_license = driverInfo.driver_license;
                
                // Only overwrite original data if new data is found in the reply
                if (driverInfo.additional_data) {
                    Object.keys(driverInfo.additional_data).forEach(key => {
                        if (driverInfo.additional_data[key] !== null && driverInfo.additional_data[key] !== undefined) {
                            finalData[key] = driverInfo.additional_data[key];
                        }
                    });
                }
            }

            // Extract product from reply lines after driver info (same way phone/weight are extracted)
            const replyLines = messageText.split('\n').map(l => l.trim()).filter(l => l);
            // Skip line 0 (ap kara) and line 1 (driver name + license)
            if (replyLines.length > 2) {
                const afterDriverText = replyLines.slice(2).join('\n');
                const replyProductInfo = extractProductInfo(afterDriverText);
                if (replyProductInfo) {
                    finalData.product_type = replyProductInfo;
                    console.log('📦 Product from reply overwrites quoted:', replyProductInfo);
                }
            }
        }

        // Convert all data to uppercase
        finalData = convertDataToUppercase(finalData);        // Validate required fields
        const missingFields = validateRequiredFields(finalData);
        
        if (missingFields.length > 0) {
            let errorMessage = "❌ *Details Missing*\n\n";
            errorMessage += "Missing: ";
            errorMessage += missingFields.map(formatFieldName).join(", ");
            
            await sock.sendMessage(chatId, {
                text: errorMessage,
                quoted: message
            });
            
            console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
            return;
        }

        // Send data to Python with chat ID and message key for replies
        const queuePosition = addToQueue(chatId, finalData, message, sock);
        
        // Send simple processing message with 0-indexed queue position 
            await sock.sendMessage(chatId, {
                text: `⏳ *Processing* - Queue #${queuePosition}`
            });
        
        
        // Start processing queue if not already running
        processQueue().catch(error => {
            console.error('❌ Queue processing error:', error);
        });

        // Return extracted data for further processing
        return finalData;

    } catch (error) {
        console.error('Error in Ap Kara command:', error);
        await sock.sendMessage(message.key.remoteJid, {
            text: "❌ Error processing the command",
            quoted: message
        });
    }
}

// Command setup listener (modified to store socket globally)
export function setupApKaraCommand(sock) {
    // Store socket globally so we can use it in Express routes
    globalSock = sock;
     // Start Express server to receive messages from Python
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Express server listening on port ${PORT}`);
        console.log(`📡 Ready to receive messages from Python at http://localhost:${PORT}/send-message`);
        console.log(`📡 Ready to receive status updates from Python at http://localhost:${PORT}/send-status`);
        console.log(`📊 Queue status available at http://localhost:${PORT}/queue-status`);
        console.log(`🧹 Queue management at http://localhost:${PORT}/clear-queue`);
        console.log(`📸 Screenshot recipient configured: ${SCREENSHOT_RECIPIENT}`);
    });
     sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        
        if (!message.message) return;
        
        // Skip if message is from the bot itself (to prevent infinite loops)
        if (message.key.fromMe) return;
        
        // Only process messages from groups
        const chatId = message.key.remoteJid;
        if (!chatId.endsWith('@g.us')) {
            return;
        }
        
        // Check if group is "Test"
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const groupName = groupMetadata.subject;
            
            if (groupName !== "Test") {
                return;
            }
        } catch (error) {
            console.error('❌ Error checking group metadata:', error);
            return;
        }
        
        // Get message text
        let messageText = '';
        if (message.message.conversation) {
            messageText = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
            messageText = message.message.extendedTextMessage.text;
        }
        
        // Check for "Ap kara" command (case insensitive)
        if (messageText.toLowerCase().includes('ap kara')) {
            await handleApKaraCommand(sock, message);
        }
    });
}

// Export functions using ES6 syntax
export {
    handleApKaraCommand,
    extractDataFromMessage,
    extractDataByLines,
    extractDriverInfo,
    dataPatterns,
    sendToPython,
    sendScreenshotToRecipient
}