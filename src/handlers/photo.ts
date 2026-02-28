import { Context } from "grammy";
import { prisma } from "../database/prisma.js";
import Replicate from "replicate";
import { getPostGenerationKeyboard } from "./keyboards.js";

// Initialize Replicate with the API token
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Mapping styles to prompts
const STYLE_PROMPTS: Record<string, string> = {
  style_castle: "A cinematic dark academia portrait of a person in a mysterious misty setting of Mir Castle towers, moody atmosphere, deep shadows, 85mm lens, dramatic natural light, texture of aged stone, sophisticated, dark luxury, masterpiece.",
  style_minsk: "A high-end cyberpunk night portrait of a person in a futuristic Minsk, reflections of neon lights on wet asphalt, National Library silhouette glowing in the background as a sci-fi artifact, rain drops, cinematic bokeh, sharp focus, 8k resolution.",
  style_oldmoney: "A soft-focus portrait of a person in a classic European library, quiet luxury aesthetic, soft natural window light, beige and cream color palette, high-quality cashmere textures, elegant, shot on 35mm film, grainy artistic texture, sophisticated.",
  style_magazine: "A dramatic high-fashion studio portrait, black and white or high-contrast, chiaroscuro lighting, editorial style, sharp facial features, flawless skin, professional retouching, Vogue aesthetics, minimalistic background.",
  style_zen: "A minimalist portrait of a person in a contemporary white studio, soft diffused daylight, clean lines, serene atmosphere, premium brand aesthetic, high-end commercial photography, soft shadows, 8k.",
  style_loft: "A warm sunset portrait in a high-end industrial loft, golden hour light filtering through tall windows, leather and metal textures, expensive interior, cinematic lighting, professional color grading, sharp detail.",
  style_woman2026: "An ethereal modern ethno-chic portrait, soft morning light, person wearing contemporary clothing with subtle national ornaments, surrounded by soft blue cornflowers, dreamlike atmosphere, 'Year of the Belarusian Woman' celebration theme, high-end editorial."
};

export const photoHandler = async (ctx: Context) => {
  if (!ctx.message?.photo) return;
  const telegramId = ctx.from?.id;

  if (!telegramId) return;

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) }
    });

    if (!user) {
      await ctx.reply("Пожалуйста, начните работу с ботом через команду /start");
      return;
    }

    // Find the first PAID or PROCESSING order for this user with remaining photos
    const order = await prisma.order.findFirst({
      where: {
        userId: user.id,
        status: { in: ["PAID", "PROCESSING"] },
        photosLeft: { gt: 0 }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!order) {
      await ctx.reply("У вас нет активных оплаченных заказов. Выберите стиль в меню /start или дождитесь подтверждения оплаты.");
      return;
    }

    // Change status to PROCESSING if it was PAID
    if (order.status === "PAID") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PROCESSING" }
      });
    }

    await ctx.reply("Фото получено! 🪄 Нейросеть начала работу. Обычно это занимает 1-2 минуты. Пожалуйста, подождите...");

    // Get the highest resolution photo URL from Telegram
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    if (!photo) throw new Error("No photo found in message");
    
    const file = await ctx.api.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Fallback to a default prompt if the style is not found in STYLE_PROMPTS
    const prompt = STYLE_PROMPTS[order.style] || STYLE_PROMPTS['style_magazine'];

    const replicateInput = {
      image: fileUrl,
      prompt: prompt,
      prompt_strength: 0.8,
      guidance_scale: 3.5,
      output_format: "jpg"
    };

    console.log(`Sending to Replicate for order ${order.id} with style ${order.style}...`);
    console.log('Параметры для Replicate:', JSON.stringify(replicateInput, null, 2));
    console.log('User photo URL:', fileUrl);
    
    // Call Replicate API without a hardcoded version hash
    const output = await replicate.run(
      "black-forest-labs/flux-dev",
      {
        input: replicateInput
      }
    );

    console.log("Replicate output:", output);

    let resultUrl = '';
    // Replicate sometimes returns an array of strings, or a single string
    if (Array.isArray(output) && output.length > 0) {
      resultUrl = String(output[0]);
    } else if (typeof output === 'string') {
      resultUrl = output;
    } else {
      resultUrl = String(output);
    }

    // Deduct one generation attempt
    const remainingPhotos = order.photosLeft - 1;
    const newStatus = remainingPhotos <= 0 ? "COMPLETED" : "PROCESSING";

    // Update order in DB
    await prisma.order.update({
      where: { id: order.id },
      data: { 
        status: newStatus, 
        photoUrl: resultUrl,
        photosLeft: remainingPhotos
      }
    });

    // Send the generated photo back to the user with post-generation keyboard
    await ctx.replyWithPhoto(resultUrl, { 
      caption: `Ваша нейро-фотография готова! 🔥 Осталось генераций в пакете: ${remainingPhotos}`,
      reply_markup: getPostGenerationKeyboard(order.style, remainingPhotos > 0)
    });

    console.log(`Order ${order.id} updated. Photos left: ${remainingPhotos}. Status: ${newStatus}`);

  } catch (error) {
    console.error("Ошибка при генерации фото:", error);
    await ctx.reply("Произошла ошибка при генерации. Попробуйте отправить фото еще раз или обратитесь в поддержку.");
  }
};
