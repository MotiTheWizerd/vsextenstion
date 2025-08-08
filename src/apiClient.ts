import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export class ApiClient {
  static async makeRequest(
    url: string,
    method: string = 'GET',
    headers: Record<string, string> = {},
    body?: any
  ): Promise<{ status: number; data: any; headers: any }> {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'RayDaemon-VSCode-Extension/1.0.0',
          ...headers
        };

        // Add Content-Length for POST/PUT requests
        if (body && (method === 'POST' || method === 'PUT')) {
          const bodyString = JSON.stringify(body);
          requestHeaders['Content-Length'] = Buffer.byteLength(bodyString).toString();
        }

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: method.toUpperCase(),
          headers: requestHeaders,
          timeout: 30000 // 30 second timeout
        };

        console.log(`[ApiClient] Making ${method} request to ${url}`);
        console.log(`[ApiClient] Request options:`, options);

        const req = client.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          
          res.on('end', () => {
            try {
              console.log(`[ApiClient] Response status: ${res.statusCode}`);
              console.log(`[ApiClient] Response data: ${data}`);
              
              let parsedData;
              try {
                parsedData = data ? JSON.parse(data) : {};
              } catch (parseError) {
                // If JSON parsing fails, return the raw data
                parsedData = data;
              }
              
              const response = {
                status: res.statusCode || 500,
                data: parsedData,
                headers: res.headers
              };
              
              resolve(response);
            } catch (error) {
              console.error(`[ApiClient] Error processing response:`, error);
              reject(error);
            }
          });
        });

        req.on('error', (error) => {
          console.error(`[ApiClient] Request failed:`, error);
          reject(error);
        });

        req.on('timeout', () => {
          console.error(`[ApiClient] Request timeout for ${url}`);
          req.destroy();
          reject(new Error(`Request timeout for ${url}`));
        });

        // Write body for POST/PUT requests
        if (body && (method === 'POST' || method === 'PUT')) {
          const bodyString = JSON.stringify(body);
          console.log(`[ApiClient] Request body:`, bodyString);
          req.write(bodyString);
        }

        req.end();
        
      } catch (error) {
        console.error(`[ApiClient] Error creating request:`, error);
        reject(error);
      }
    });
  }

  static async get(url: string, headers: Record<string, string> = {}) {
    return this.makeRequest(url, 'GET', headers);
  }

  static async post(url: string, data: any = {}, headers: Record<string, string> = {}) {
    return this.makeRequest(url, 'POST', headers, data);
  }

  static async put(url: string, data: any = {}, headers: Record<string, string> = {}) {
    return this.makeRequest(url, 'PUT', headers, data);
  }

  static async delete(url: string, headers: Record<string, string> = {}) {
    return this.makeRequest(url, 'DELETE', headers);
  }
}
