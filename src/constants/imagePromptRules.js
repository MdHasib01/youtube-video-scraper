/**
 * Shared image-generation safety rules.
 *
 * These restrictions are appended to EVERY prompt sent to `gpt-image-1`
 * (or any future image model) across the entire project so that
 * generated images never contain photorealistic humans or real faces.
 *
 * Allowed: abstract illustrations, business illustrations, icons, objects,
 * charts, technology, landscapes, buildings, products, text (when the prompt
 * allows it), cartoon or illustrated humans.
 *
 * Forbidden: photorealistic humans, realistic faces, portrait photography,
 * selfie-style people, AI-generated people that look like real humans,
 * realistic facial features.
 *
 * Usage:
 *   import { withImageRestrictions } from "../constants/imagePromptRules.js";
 *   const finalPrompt = withImageRestrictions(myPrompt);
 *   openai.images.generate({ model: "gpt-image-1", prompt: finalPrompt, ... });
 */

export const IMAGE_GLOBAL_RESTRICTIONS = `IMPORTANT IMAGE RESTRICTIONS:

- Never generate any photorealistic or realistic human.
- Never generate a real human face.
- Never generate realistic portraits, people, selfies, or photographs of humans.
- If a person is needed for the concept, use only flat illustration, vector art, cartoon, line art, silhouette, iconography, or abstract human figures.
- The image must never resemble a real person or contain realistic facial features.
- Prefer objects, devices, charts, environments, symbols, business concepts, abstract graphics, geometric shapes, or illustrations instead of people.
- Do not create photo-style images of humans under any circumstance.
- Text, typography, icons, logos, graphics, diagrams, and other non-human visual elements are allowed.`;

/**
 * Append the global image restrictions to any prompt.
 * Safe to call multiple times — it will only append once.
 *
 * @param {string} prompt - The base image-generation prompt.
 * @returns {string} Prompt with the global restrictions appended.
 */
export function withImageRestrictions(prompt) {
  const base = (prompt ?? "").toString().trim();
  if (base.includes(IMAGE_GLOBAL_RESTRICTIONS)) return base;
  if (!base) return IMAGE_GLOBAL_RESTRICTIONS;
  return `${base}\n\n${IMAGE_GLOBAL_RESTRICTIONS}`;
}

export default { IMAGE_GLOBAL_RESTRICTIONS, withImageRestrictions };
