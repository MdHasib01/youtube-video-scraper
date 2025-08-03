import OpenAI from "openai";
import { uploadImageUrlToCloudinary } from "../services/cloudinary.service.js"; // Adjust path as needed

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate AI-powered blog content for Chris Gray
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const generateAiContent = async (req, res) => {
  try {
    // Extract and validate input
    const {
      title,
      keywords,
      targetAudience,
      contentLength = "medium",
    } = req.body;

    if (!title) {
      return res.status(400).json({
        error: "Title is required",
        message: "Please provide a blog post title",
      });
    }

    // Construct the React Quill optimized content generation prompt
    const contentPrompt = `
You are writing a high-quality blog post for Chris Gray, who is a renowned Entrepreneur, Community Builder & Marketing Expert. 

**IMPORTANT: Format the content as clean HTML that works perfectly with React Quill editor.**

**Post Title:** ${title}

**About Chris Gray:**
- Successful entrepreneur with multiple ventures
- Expert in community building and engagement strategies  
- Marketing specialist with deep knowledge of digital marketing, growth hacking, and brand building
- Known for practical, actionable advice
- Speaks to ambitious entrepreneurs, marketers, and business leaders

**Content Requirements:**
- Write in Chris Gray's authoritative yet approachable voice
- Include practical, actionable insights and strategies
- Use real-world examples and case studies where appropriate
- Target audience: ${
      targetAudience || "entrepreneurs and marketing professionals"
    }
- Content length: ${contentLength} (short: 800-1200 words, medium: 1200-1800 words, long: 1800-2500 words)
${keywords ? `- Include these keywords naturally: ${keywords}` : ""}

**HTML FORMATTING REQUIREMENTS FOR REACT QUILL:**
- Use <h2> for main section headings
- Use <h3> for subsections
- Use <p> tags for all paragraphs
- Use <strong> for bold text (not <b>)
- Use <em> for italic text (not <i>)
- Use <ul> and <li> for bullet points
- Use <ol> and <li> for numbered lists
- Use <blockquote> for quotes or callouts
- Use proper line breaks with </p><p> between paragraphs
- NO markdown formatting (##, **, *, etc.)
- NO div tags or complex CSS classes
- Keep HTML clean and semantic

**Structure the post with:**
1. Compelling introduction paragraph in <p> tags
2. 3-5 main sections with <h2> headings
3. Subsections with <h3> headings where needed
4. Use <ul> lists for actionable tips and key points
5. Include <blockquote> sections for important insights
6. End with engaging conclusion and call-to-action in <p> tags

**Tone & Style:**
- Professional yet conversational
- Confident and authoritative
- Include personal anecdotes where relevant
- Use data and statistics to support points
- Make it scannable with proper HTML structure

**EXAMPLE FORMAT:**
<p>Your compelling introduction paragraph here...</p>

<h2>First Main Section</h2>
<p>Introduction to this section...</p>

<h3>Subsection Title</h3>
<p>Content here with <strong>important points</strong> highlighted.</p>

<ul>
<li>First actionable tip</li>
<li>Second actionable tip</li>
<li>Third actionable tip</li>
</ul>

<blockquote>
<p>Important insight or quote that stands out</p>
</blockquote>

<h2>Second Main Section</h2>
<p>Continue with more sections...</p>

Write the complete blog post now in clean HTML format:
    `;

    // Generate content using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4", // Using GPT-4 for better content quality
      messages: [
        {
          role: "system",
          content:
            "You are a professional content writer specializing in entrepreneurship, marketing, and community building. You write in an engaging, authoritative voice that provides real value to business professionals. ALWAYS format your content as clean HTML that works perfectly with React Quill editor. Use proper HTML tags like <p>, <h2>, <h3>, <strong>, <em>, <ul>, <li>, <blockquote>. Never use markdown formatting.",
        },
        {
          role: "user",
          content: contentPrompt,
        },
      ],
      max_tokens: 3000,
      temperature: 0.7, // Balanced creativity and consistency
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    // Extract the generated content
    let generatedContent = response.choices[0]?.message?.content;

    if (!generatedContent) {
      return res.status(500).json({
        error: "Content generation failed",
        message: "No content was generated. Please try again.",
      });
    }

    // Clean up the content for React Quill
    generatedContent = cleanContentForReactQuill(generatedContent);

    // Calculate word count (strip HTML for accurate count)
    const textContent = generatedContent.replace(/<[^>]*>/g, "");
    const wordCount = textContent
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    // Return structured response
    res.status(200).json({
      title,
      content: generatedContent,
      wordCount,
      generatedAt: new Date().toISOString(),
      author: "Chris Gray",
      metadata: {
        targetAudience:
          targetAudience || "entrepreneurs and marketing professionals",
        contentLength,
        keywords: keywords || null,
        format: "html_for_react_quill",
      },
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    });
  } catch (error) {
    console.error("Content generation error:", error);

    // Handle specific OpenAI errors
    if (error.code === "insufficient_quota") {
      return res.status(402).json({
        error: "API quota exceeded",
        message: "Please check your OpenAI billing and usage limits",
      });
    }

    if (error.code === "invalid_api_key") {
      return res.status(401).json({
        error: "Invalid API key",
        message: "Please check your OpenAI API key configuration",
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate content. Please try again later.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to clean and optimize content for React Quill
const cleanContentForReactQuill = (content) => {
  return (
    content
      // Remove any markdown-style formatting that might slip through
      .replace(/#{1,6}\s/g, "") // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Convert **bold** to <strong>
      .replace(/\*(.*?)\*/g, "<em>$1</em>") // Convert *italic* to <em>

      // Ensure proper paragraph wrapping
      .replace(/\n\n/g, "</p><p>")
      .replace(/^(?!<[ph])/gm, "<p>") // Add opening <p> to lines that don't start with HTML tags
      .replace(/(?<!>)$/gm, "</p>") // Add closing </p> to lines that don't end with >

      // Clean up any double tags
      .replace(/<\/p><p><\/p>/g, "</p>")
      .replace(/<p><\/p>/g, "")

      // Ensure blockquotes are properly formatted
      .replace(/<blockquote>\s*<p>/g, "<blockquote><p>")
      .replace(/<\/p>\s*<\/blockquote>/g, "</p></blockquote>")

      // Clean up any extra whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
};
/**
 * Generate AI-powered images for blog post titles
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const generateAiImage = async (req, res) => {
  try {
    // Extract and validate input
    const {
      title,
      style = "professional",
      size = "1024x1024",
      quality = "standard",
    } = req.body;

    if (!title) {
      return res.status(400).json({
        error: "Title is required",
        message: "Please provide a blog post title for image generation",
      });
    }

    // Define style presets
    const stylePresets = {
      professional:
        "professional, clean, modern business style with corporate colors",
      creative:
        "creative, vibrant, artistic with bold colors and dynamic composition",
      minimal: "minimalist, clean, simple design with lots of white space",
      tech: "modern technology theme with digital elements, gradients, and tech aesthetics",
      entrepreneur:
        "entrepreneurial theme with success imagery, growth charts, business concepts",
    };

    // Construct the image generation prompt
    const imagePrompt = `
Create a high-quality blog header image for the title: "${title}"

**Visual Style:** ${stylePresets[style] || stylePresets.professional}

**Design Requirements:**
- Professional blog header image suitable for Chris Gray's brand
- Chris Gray is an Entrepreneur, Community Builder & Marketing Expert
- Include visual elements that relate to: entrepreneurship, marketing, community building, business growth
- Modern, clean aesthetic that works well as a blog featured image
- Ensure text overlay space at the top or center for the blog title
- Use professional color palette (blues, grays, whites with accent colors)
- High-quality, web-optimized appearance
- Avoid any text in the image itself
- Focus on conceptual imagery that supports the blog topic

**Theme Elements to Consider:**
- Business growth and success imagery
- Community and networking concepts  
- Marketing and digital strategy visuals
- Entrepreneurial journey and achievement
- Professional development and expertise

The image should be engaging, professional, and immediately convey the expertise and authority of Chris Gray while supporting the blog post topic.
    `;

    // Validate size parameter
    const validSizes = [
      "256x256",
      "512x512",
      "1024x1024",
      "1792x1024",
      "1024x1792",
    ];
    if (!validSizes.includes(size)) {
      return res.status(400).json({
        error: "Invalid size parameter",
        message: `Size must be one of: ${validSizes.join(", ")}`,
      });
    }

    // Generate image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: size,
      quality: quality, // "standard" or "hd"
      style: "natural", // "natural" or "vivid"
      response_format: "url",
    });

    const generatedImage = response.data[0];

    if (!generatedImage) {
      return res.status(500).json({
        error: "Image generation failed",
        message: "No image was generated. Please try again.",
      });
    }

    // Generate a unique public ID for Cloudinary
    const publicId = `blog-${Date.now()}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 50)}`;

    // Upload the generated image to Cloudinary
    const cloudinaryResult = await uploadImageUrlToCloudinary(
      generatedImage.url,
      publicId
    );

    if (!cloudinaryResult) {
      return res.status(500).json({
        error: "Image upload failed",
        message: "Failed to upload image to Cloudinary. Please try again.",
      });
    }

    // Return structured response with Cloudinary URL
    res.status(200).json({
      title,
      imageUrl: cloudinaryResult.url, // Cloudinary URL instead of OpenAI URL
      publicId: cloudinaryResult.publicId,
      revisedPrompt: generatedImage.revised_prompt,
      generatedAt: new Date().toISOString(),
      metadata: {
        style,
        size,
        quality,
        model: "dall-e-3",
        cloudinaryFolder: "blog-images",
      },
    });
  } catch (error) {
    console.error("Image generation error:", error);

    // Handle specific OpenAI errors
    if (error.code === "insufficient_quota") {
      return res.status(402).json({
        error: "API quota exceeded",
        message: "Please check your OpenAI billing and usage limits",
      });
    }

    if (error.code === "content_policy_violation") {
      return res.status(400).json({
        error: "Content policy violation",
        message:
          "The image prompt violates OpenAI's content policy. Please try a different title or approach.",
      });
    }

    if (error.code === "invalid_api_key") {
      return res.status(401).json({
        error: "Invalid API key",
        message: "Please check your OpenAI API key configuration",
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate image. Please try again later.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Health check endpoint for the AI services
 */
export const healthCheck = async (req, res) => {
  try {
    // Test OpenAI API connectivity
    const testResponse = await openai.models.list();

    res.status(200).json({
      success: true,
      message: "AI services are operational",
      timestamp: new Date().toISOString(),
      availableModels: testResponse.data.slice(0, 5).map((model) => model.id),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "AI services are unavailable",
      error: error.message,
    });
  }
};
