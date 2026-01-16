const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { syncUserCanvasData } = require('../services/canvasSyncService');

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const scheduleCanvasSync = () => {
    // Schedule: Every 6 hours '0 */6 * * *'
    cron.schedule('0 */6 * * *', async () => {
        console.log('⏰ [Cron] Starting scheduled Canvas sync...');

        if (!supabase) {
            console.error('❌ [Cron] Supabase not initialized, skipping sync.');
            return;
        }

        try {
            // Find eligible users: canvas_sync_enabled = true AND plan_type = 'Pro' (or is_pro = true)
            // Assuming is_pro boolean is the source of truth for "Pro Plan" based on previous context.
            // And assuming 'canvas_sync_enabled' column exists. If not, this might fail or return empty if checking incorrectly.
            // Safe query: check is_pro = true. If canvas_sync_enabled is missing, we might need to skip that check or handle error.
            // Since User specifically asked for "where canvas_sync_enabled is true", I will include it.

            const { data: users, error } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('is_pro', true)
                .eq('canvas_sync_enabled', true);

            if (error) {
                console.error('❌ [Cron] Error fetching users for sync:', error.message);
                return;
            }

            console.log(`[Cron] Found ${users.length} Pro users with sync enabled.`);

            for (const user of users) {
                try {
                    const result = await syncUserCanvasData(user.id);

                    if (result.newMaterials > 0) {
                        // Send Notification (Mock)
                        console.log(`🔔 [Notification] Sent to ${user.email}: "We found ${result.newMaterials} new files on Canvas and added them to your Study App!"`);

                        // In a real app, you'd insert into a notifications table or call an email service here.
                    }
                } catch (syncErr) {
                    console.error(`❌ [Cron] Failed to sync user ${user.id}:`, syncErr.message);
                }
            }

        } catch (err) {
            console.error('❌ [Cron] Unexpected error:', err);
        }
    });

    console.log('✅ Canvas Sync Cron Job scheduled (Every 6 hours)');
};

module.exports = scheduleCanvasSync;
