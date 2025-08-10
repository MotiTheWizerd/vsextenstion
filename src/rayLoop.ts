import { config } from './config';
import { ApiClient } from './apiClient';

export async function sendToRayLoop(prompt: string): Promise<string> {
  try {
    console.log(`[RayDaemon] Sending message to Ray API: ${prompt}`);
    
    // Format the message using the config formatter
    const messageData = config.formatMessage(prompt);
    
    console.log(`[RayDaemon] Sending to ${config.apiEndpoint}:`, messageData);
    
    // Send to the configured API endpoint
    const response = await ApiClient.post(
      config.apiEndpoint,
      messageData,
      config.apiHeaders
    );
    
    console.log(`[RayDaemon] API Response Status: ${response.status}`);
    console.log(`[RayDaemon] API Response Data:`, response.data);
    
    // Handle different response formats
    if (response.status >= 200 && response.status < 300) {
      // Check if this is a "start working" status response
      if (response.data?.status === 'start working' || 
          response.data?.status === 'working' ||
          response.data?.message === 'start working') {
        return '🔄 **Ray is working on your request...** \n\nPlease wait while Ray processes your message. You\'ll receive the response shortly.';
      }
      
      // Extract the response message
      let responseMessage = '';
      
      if (typeof response.data === 'string') {
        responseMessage = response.data;
      } else if (response.data?.response) {
        responseMessage = response.data.response;
      } else if (response.data?.message) {
        responseMessage = response.data.message;
      } else if (response.data?.content) {
        responseMessage = response.data.content;
      } else if (response.data?.text) {
        responseMessage = response.data.text;
      } else {
        responseMessage = JSON.stringify(response.data, null, 2);
      }
      
      return responseMessage || 'Response received but no content found.';
    } else {
      throw new Error(`API returned status ${response.status}: ${JSON.stringify(response.data)}`);
    }
    
  } catch (error) {
    console.error('[RayDaemon] Error sending to Ray API:', error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        return `❌ **Connection Error**: Cannot connect to Ray API at ${config.apiEndpoint}. Please make sure your Ray server is running.`;
      } else if (error.message.includes('ENOTFOUND')) {
        return `❌ **DNS Error**: Cannot resolve hostname. Please check your API endpoint configuration.`;
      } else if (error.message.includes('timeout')) {
        return `❌ **Timeout Error**: Ray API is not responding. Please check if the server is running properly.`;
      } else {
        return `❌ **API Error**: ${error.message}`;
      }
    }
    
    return `❌ **Unknown Error**: Failed to process request`;
  }
}

export async function sendCommandResultsToRay(originalMessage: string, commandResults: any[]): Promise<void> {
  try {
    console.log(`[RayDaemon] Sending command results back to Ray:`, commandResults);
    
    // Format message with populated command results
    const messageData = config.formatMessageWithResults(originalMessage, commandResults);
    
    console.log(`[RayDaemon] Sending command results to ${config.apiEndpoint}:`, messageData);
    
    // Send to main API endpoint with populated command results (same as user messages)
    await ApiClient.post(
      config.apiEndpoint,
      messageData,
      config.apiHeaders
    );
    
    console.log(`[RayDaemon] Command results sent successfully to Ray`, messageData);
    
  } catch (error) {
    console.error('[RayDaemon] Error sending command results to Ray:', error);
    throw error;
  }
}
