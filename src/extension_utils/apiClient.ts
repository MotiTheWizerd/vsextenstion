import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

interface ApiResponse {
    status: number;
    data: any;
    headers: any;
}

export class ApiClient {
    static async makeRequest(
        url: string,
        method: string = "GET",
        headers: Record<string, string> = {},
        body?: string
    ): Promise<ApiResponse> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const isHttps = parsedUrl.protocol === "https:";
            const client = isHttps ? https : http;

            const requestHeaders: Record<string, string> = {
                "Content-Type": "application/json",
                "User-Agent": "RayDaemon-VSCode-Extension/1.0.0",
                ...headers,
            };

            if (body && method.toUpperCase() !== "GET") {
                requestHeaders["Content-Length"] = Buffer.byteLength(body).toString();
            }

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: method.toUpperCase(),
                headers: requestHeaders,
            };

            const req = client.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    try {
                        const parsedData = data ? JSON.parse(data) : {};
                        resolve({
                            status: res.statusCode || 0,
                            data: parsedData,
                            headers: res.headers,
                        });
                    } catch (error) {
                        resolve({
                            status: res.statusCode || 0,
                            data: data,
                            headers: res.headers,
                        });
                    }
                });
            });

            req.on("error", (error) => {
                reject(error);
            });

            if (body && method.toUpperCase() !== "GET") {
                req.write(body);
            }

            req.end();
        });
    }

    static async get(url: string, headers?: Record<string, string>): Promise<ApiResponse> {
        return this.makeRequest(url, "GET", headers);
    }

    static async post(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse> {
        const body = data ? JSON.stringify(data) : undefined;
        return this.makeRequest(url, "POST", headers, body);
    }

    static async put(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse> {
        const body = data ? JSON.stringify(data) : undefined;
        return this.makeRequest(url, "PUT", headers, body);
    }

    static async delete(url: string, headers?: Record<string, string>): Promise<ApiResponse> {
        return this.makeRequest(url, "DELETE", headers);
    }
}
