const crypto = require('crypto');

// Ensure ENCRYPTION_KEY is defined in your .env file
// It must be a 32-character string for aes-256-cbc
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16; // For AES, this is always 16

function encryptToken(token) {
    if (!ENCRYPTION_KEY) {
        throw new Error("ENCRYPTION_KEY is not defined in environment variables");
    }
    // Check key length
    if (ENCRYPTION_KEY.length !== 32) {
        // NOTE: If using a hex string key, you might need Buffer.from(key, 'hex') and check byte length
        // Assuming naive string for now as per common 'process.env' usage unless specified otherwise
        // Ideally this checks Buffer.byteLength(ENCRYPTION_KEY) but user instruction implies direct use.
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(token);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptToken(encryptedData) {
    if (!ENCRYPTION_KEY) {
        throw new Error("ENCRYPTION_KEY is not defined in environment variables");
    }

    const textParts = encryptedData.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

module.exports = { encryptToken, decryptToken };
