const { createClient } = require('@supabase/supabase-js');
const CanvasService = require('./canvasService');
const { decryptToken } = require('../utils/security');
const pdfParseLib = require('pdf-parse');
const PDFParse = pdfParseLib.PDFParse;

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
} else {
    console.error('❌ Supabase configuration missing in canvasSyncService');
}

// PDF Text Extraction Helper
async function extractTextFromPdf(buffer) {
    try {
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        return pdfData.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        return null;
    }
}

// AI Analysis Helper
async function analyzeFileContent(text, fileName, supabaseClient) {
    // Truncate text to avoid token limits (approx 15k chars)
    const cleanText = text.slice(0, 15000);

    const prompt = `You are an expert study assistant. Analyze this document ("${fileName}") using the Feynman Technique.
  
  1. **Summarize** the core concepts in simple language (as if teaching a beginner).
  2. **Identify Key Terms** definitions.
  3. **Create 3 Review Questions** to test understanding.

  Return the result as valid JSON with this structure:
  {
    "summary": "...",
    "key_terms": [{ "term": "...", "definition": "..." }],
    "review_questions": [{ "question": "...", "answer": "..." }]
  }
  
  Document Text:
  ${cleanText}`;

    try {
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/gemini-chat`;

        // Use the passed client's auth or the service role key appropriately.
        // Here we use the service role key available in this module's scope for simplicity and permission/bypass.
        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
                prompt: prompt,
                model: 'gemini-2.5-flash',
                temperature: 0.5,
                maxTokens: 4096,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`AI request failed: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();

        // Parse the inner text/response
        let responseText = data.text || data.response || (typeof data === 'string' ? data : JSON.stringify(data));

        // Clean markdown
        if (responseText.includes('```json')) {
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        // Extract JSON block
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            responseText = responseText.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(responseText);
    } catch (error) {
        console.error('AI Analysis failed:', error);
        return { error: 'Analysis failed', details: error.message };
    }
}

/**
 * Syncs Canvas data for a specific user.
 * @param {string} userId 
 * @returns {Promise<Object>} Result summary
 */
async function syncUserCanvasData(userId) {
    if (!supabase) throw new Error('Supabase not initialized');

    try {
        console.log(`🔄 [Service] Starting Canvas sync for user ${userId}`);

        // 1. Fetch encrypted token
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('canvas_token, canvas_domain')
            .eq('id', userId)
            .single();

        if (profileError || !profile || !profile.canvas_token) {
            throw new Error('Canvas token not found or profile invalid.');
        }

        // 2. Decrypt Token
        const apiToken = decryptToken(profile.canvas_token);
        const canvasDomain = profile.canvas_domain || 'canvas.instructure.com';
        const canvas = new CanvasService(apiToken, canvasDomain);

        // 3. Fetch Courses
        const courses = await canvas.getCourses();
        let newFilesCount = 0;
        const errors = [];

        // 4. Iterate Courses
        for (const course of courses) {
            let files = [];
            try {
                files = await canvas.getFiles(course.id);
            } catch (err) {
                console.error(`Failed to fetch files for course ${course.id}:`, err.message);
                continue;
            }

            for (const file of files) {
                // Check existence
                const { data: existing } = await supabase
                    .from('study_materials')
                    .select('id')
                    .eq('canvas_file_id', String(file.id))
                    .eq('user_id', userId)
                    .single();

                if (existing) continue;

                console.log(`📥 [Service] New file: ${file.display_name}`);

                try {
                    // Download & Analyze
                    const fileBuffer = await canvas.downloadFile(file.url);
                    const text = await extractTextFromPdf(fileBuffer);

                    if (!text) {
                        console.warn(`Could not extract text from ${file.display_name}`);
                        continue;
                    }

                    const analysisResult = await analyzeFileContent(text, file.display_name, supabase);

                    // Save
                    const { error: insertError } = await supabase
                        .from('study_materials')
                        .insert({
                            user_id: userId,
                            course_id: String(course.id),
                            course_name: course.name,
                            canvas_file_id: String(file.id),
                            file_name: file.display_name,
                            file_url: file.url,
                            content_type: file['content-type'],
                            file_size: file.size,
                            analysis_json: analysisResult,
                            created_at: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error('DB Insert Error:', insertError);
                        errors.push({ file: file.display_name, error: insertError.message });
                    } else {
                        newFilesCount++;
                        console.log(`✅ [Service] Saved analysis for ${file.display_name}`);
                    }

                } catch (processError) {
                    console.error(`Failed to process file ${file.display_name}:`, processError.message);
                    errors.push({ file: file.display_name, error: processError.message });
                }
            }
        }

        return {
            success: true,
            newMaterials: newFilesCount,
            errors: errors
        };

    } catch (error) {
        console.error(`[Service] Sync Error (User ${userId}):`, error.message);
        throw error;
    }
}

module.exports = { syncUserCanvasData };
