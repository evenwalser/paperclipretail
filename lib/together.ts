// Define expected response type
type TogetherAIResponse = {
  title: string;
  description: string;
  price_avg: number;
  category_id: string;
  condition?: string;
};

export async function analyzeImage(imageData: string | File): Promise<TogetherAIResponse> {
  try {
    console.log('Starting image analysis...');
    const formData = new FormData();

    if (typeof imageData === 'string') {
      if (imageData.startsWith('data:image')) {
        // Convert base64 data URL to Blob
        const response = await fetch(imageData);
        const blob = await response.blob();
        formData.append('image', blob, 'image.jpg');
      } else if (imageData.startsWith('https')) {
        // If imageData is already a public URL, append it with the key "image_url"
           formData.append('image', imageData); 
      } else {
        throw new Error('Invalid image format');
      }
    } else if (imageData instanceof File) {
      formData.append('image', imageData);
    } else {
      throw new Error('Invalid image format');
    }

    // Send to our API route
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}
