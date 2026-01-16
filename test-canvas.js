const CanvasService = require('./services/canvasService');

// REPLACE THIS WITH YOUR ACTUAL TOKEN
const token = '[PASTE_YOUR_SANDBOX_TOKEN]';
const domain = 'canvas.instructure.com';

async function testConnection() {
    try {
        console.log('Initializing Canvas Service...');
        const canvas = new CanvasService(token, domain);

        console.log('Fetching courses...');
        const courses = await canvas.getCourses();
        console.log(`Found ${courses.length} courses.`);

        const targetCourseName = 'MindFlow Test Course';
        const course = courses.find(c => c.name === targetCourseName);

        if (!course) {
            console.error(`Course "${targetCourseName}" not found!`);
            console.log('Available courses:', courses.map(c => c.name).join(', '));
            return;
        }

        console.log(`Found course: ${course.name} (ID: ${course.id})`);
        console.log('Fetching files...');

        const files = await canvas.getFiles(course.id);

        console.log('\n--- Files in Course ---');
        files.forEach(file => {
            console.log(`- ${file.display_name} (${file.size} bytes)`);
        });
        console.log('-----------------------\n');

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.status, error.response.statusText);
        }
    }
}

testConnection();
