const axios = require('axios');
const fs = require('fs');

class CanvasService {
    constructor(apiToken, canvasDomain) {
        if (!apiToken || !canvasDomain) {
            throw new Error("CanvasService requires API Token and Domain.");
        }

        // Ensure domain has protocol
        this.baseUrl = canvasDomain.startsWith('http')
            ? canvasDomain
            : `https://${canvasDomain}`;

        // Remove trailing slash if present
        this.baseUrl = this.baseUrl.replace(/\/$/, '');

        this.client = axios.create({
            baseURL: `${this.baseUrl}/api/v1`,
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Helper to handle pagination (Canvas uses Link headers)
     * Fetches all pages for a given URL
     */
    async _fetchAllPages(url, params = {}) {
        let results = [];
        let nextUrl = url;

        // Params for the first request
        let currentParams = { ...params, per_page: 100 };

        while (nextUrl) {
            try {
                console.log(`Fetching Canvas data: ${nextUrl}`);
                // If nextUrl is a full URL (from Link header), don't prepend baseURL (axios handles absolute URLs)
                const isAbsolute = nextUrl.startsWith('http');

                const response = await this.client.get(nextUrl, {
                    params: isAbsolute ? undefined : currentParams
                });

                results = results.concat(response.data);

                // Parse Link header for 'next' relation
                const linkHeader = response.headers['link'];
                nextUrl = null;
                currentParams = undefined; // Clear params for subsequent absolute URL requests

                if (linkHeader) {
                    const links = linkHeader.split(',');
                    for (const link of links) {
                        const [urlPart, relPart] = link.split(';');
                        if (relPart && relPart.trim() === 'rel="next"') {
                            // Extract URL from <url>
                            nextUrl = urlPart.trim().slice(1, -1);
                            break;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching from Canvas (${nextUrl}):`, error.message);
                throw error;
            }
        }

        return results;
    }

    /**
     * Fetches all active student enrollments
     */
    async getCourses() {
        try {
            // Filter for active courses where the user is a student
            const params = {
                enrollment_type: 'student',
                enrollment_state: 'active',
                state: ['available'], // Only available courses
                include: ['term'] // useful context
            };

            return await this._fetchAllPages('/courses', params);
        } catch (error) {
            console.error('Error fetching active courses:', error.message);
            throw error;
        }
    }

    /**
     * Lists all PDF files in a specific course
     */
    async getFiles(courseId) {
        try {
            // Filter for PDF files
            const params = {
                'content_types[]': 'application/pdf',
                sort: 'created_at',
                order: 'desc'
            };

            return await this._fetchAllPages(`/courses/${courseId}/files`, params);
        } catch (error) {
            console.error(`Error fetching files for course ${courseId}:`, error.message);
            throw error;
        }
    }

    /**
     * Downloads a file as a buffer
     * @param {string} fileUrl - The full download URL provided by Canvas file object
     * @returns {Promise<Buffer>}
     */
    async downloadFile(fileUrl) {
        try {
            if (!fileUrl) throw new Error("File URL is required");

            const response = await axios.get(fileUrl, {
                headers: this.client.defaults.headers, // Use same auth headers
                responseType: 'arraybuffer'
            });

            return Buffer.from(response.data);
        } catch (error) {
            console.error(`Error downloading file from ${fileUrl}:`, error.message);
            throw error;
        }
    }
}

module.exports = CanvasService;
