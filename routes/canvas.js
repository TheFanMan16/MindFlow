const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { syncUserCanvasData } = require('../services/canvasSyncService');
const CanvasService = require('../services/canvasService');
const { encryptToken } = require('../utils/security');

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// POST /api/canvas/test-connection
router.post('/test-connection', async (req, res) => {
    const { token, domain } = req.body;

    if (!token || !domain) {
        return res.status(400).json({ error: 'Token and Domain are required' });
    }

    try {
        const canvas = new CanvasService(token, domain);
        // Try fetching courses to validate token
        // We limit to 1 per_page to keep it fast
        const courses = await canvas._fetchAllPages('/courses', {
            per_page: 1,
            enrollment_type: 'student',
            enrollment_state: 'active'
        });

        res.json({ success: true, message: 'Connection successful', coursesFound: courses.length });
    } catch (error) {
        console.error('Canvas Test Connection Failed:', error.message);
        res.status(401).json({ error: 'Connection failed. Please check your Token and Domain.' });
    }
});

// POST /api/canvas/save-connection
router.post('/save-connection', async (req, res) => {
    const { userId, token, domain } = req.body;

    if (!userId || !token || !domain) {
        return res.status(400).json({ error: 'User ID, Token, and Domain are required' });
    }

    try {
        // 1. Encrypt the token
        const encryptedToken = encryptToken(token);

        // 2. Save to profiles
        const { error } = await supabase
            .from('profiles')
            .update({
                canvas_token: encryptedToken,
                canvas_domain: domain,
                canvas_sync_enabled: true // Enable sync by default on connect
            })
            .eq('id', userId);

        if (error) throw error;

        res.json({ success: true, message: 'Canvas connected successfully!' });
    } catch (error) {
        console.error('Save Canvas Connection Failed:', error.message);
        res.status(500).json({ error: 'Failed to save connection.' });
    }
});

// POST /api/canvas/sync
router.post('/sync', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const result = await syncUserCanvasData(userId);
        res.json({
            success: true,
            message: `Sync complete. Added ${result.newMaterials} new study materials.`,
            newMaterials: result.newMaterials,
            errors: result.errors.length > 0 ? result.errors : undefined
        });
    } catch (error) {
        let status = 500;
        if (error.message.includes('not found')) status = 404;

        res.status(status).json({ error: error.message });
    }
});

module.exports = router;
