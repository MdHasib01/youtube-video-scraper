export const fakeImageUrl = async (req, res) => {
  res.json({
    title: "Understanding the Path from Employee to Business Owner",
    imageUrl:
      "https://res.cloudinary.com/mdhasib/image/upload/v1754255151/wagaha5kqfugvlkrgcue.png",
    publicId: "wagaha5kqfugvlkrgcue",
    revisedPrompt:
      "Create a professional, clean, and modern styled blog header image suited for a successful business persona. The image should incorporate elements associated with entrepreneurship, marketing, community building, and business growth. It must have a modern, clean aesthetic that would suit a blog post's featured image. The color palette should comprise professional tones of blue, gray and white, perhaps with occasional accent colors. Make sure the image indicates room at the top or center for placing the blog title but should not contain any text itself. The pivotal elements to consider during creation should portray business growth, community networking, digital marketing strategy, accomplishments in entrepreneurship, and professional development.",
    generatedAt: new Date().toISOString(),
    metadata: {
      style: "professional",
      size: "1024x1024",
      quality: "standard",
      model: "dall-e-3",
      cloudinaryFolder: "blog-images",
    },
  });
};

export const fakeContent = async (req, res) => {
  res.json({
    title: "Understanding the Path from Employee to Business Owner",
    content:
      "<p>Welcome to the journey from being an employee to becoming a business owner. It's a transformation that requires grit, knowledge, and an entrepreneurial spirit. This post will guide you through this path with practical, actionable strategies.</p></p><p><h2>The Leap from Employee to Entrepreneur</h2> <p>Moving from the safety of a steady paycheck to the world of business ownership is a significant step. It requires a change in mindset, a willingness to take on risk, and the ability to wear many hats.</p></p><p><h3>Changing Your Mindset</h3> <p>One of the most critical transitions is shifting your mindset from that of an employee to an entrepreneur. This is where <strong>self-belief</strong> and <strong>perseverance</strong> come into play.</p></p><p><ul> <p><li>Believe in your abilities and vision.</li> <p><li>Be ready for challenges and setbacks.</li> <p><li>Develop resilience and learn from failures.</li> <p></ul></p><p><blockquote><p>\"The transition from employee to entrepreneur isn't always smooth, but it's a worthwhile journey for those willing to embrace the ride.\"</p> <p></blockquote></p><p><h2>Building a Strong Network</h2> <p>Surrounding yourself with a network of mentors, peers, and professionals can provide invaluable support and insight as you embark on your entrepreneurial journey.</p></p><p><h3>Leveraging Community</h3> <p>Tap into the wealth of knowledge that exists within your community. Attend local events, join online forums, and participate in networking groups.</p></p><p><ul> <p><li>Find mentors who can guide you.</li> <p><li>Connect with peers to learn from their experiences.</li> <p><li>Build relationships with professionals in your industry.</li> <p></ul></p><p><blockquote><p>\"Your network is your net worth. Each connection is an opportunity for growth.\"</p> <p></blockquote></p><p><h2>Mastering Marketing</h2> <p>As an entrepreneur, marketing isn't just a department; it's at the heart of your business. Understanding how to effectively promote your brand and products is crucial for success.</p></p><p><h3>Digital Marketing Strategies</h3> <p>In today's digital age, understanding how to leverage online platforms is essential. From social media to SEO, digital marketing can propel your business forward.</p></p><p><ul> <p><li>Learn the basics of SEO to increase your online visibility.</li> <p><li>Use social media to engage with your community and promote your brand.</li> <p><li>Consider email marketing as a way to maintain customer relationships.</li> <p></ul></p><p><blockquote><p>\"Marketing is the lifeblood of your business. Without it, your business is like a car without an engine.\"</p> <p></blockquote></p><p><p>The journey from employee to business owner is exciting and challenging. But with the right mindset, a strong network, and a grasp on effective marketing strategies, you can navigate this path successfully. Remember, every journey begins with a single step. Take that step today and start your entrepreneurial journey.</p>",
    wordCount: 538,
    generatedAt: "2025-08-03T21:03:16.763Z",
    author: "Chris Gray",
    metadata: {
      targetAudience: "entrepreneurs and marketing professionals",
      contentLength: "medium",
      keywords: null,
    },
  });
};
