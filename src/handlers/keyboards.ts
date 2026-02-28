import { InlineKeyboard, Keyboard } from "grammy";

export const getReplyMainMenu = () => {
  return new Keyboard()
    .text("📸 Создать фото").text("👤 Мой профиль").row()
    .text("🖼 Галерея стилей").text("💳 Пакеты и цены").row()
    .text("ℹ️ Помощь")
    .resized();
};

export const getMainMenuKeyboard = () => {
  return new InlineKeyboard()
    .text("💎 Тихая роскошь", "style_oldmoney").text("📸 Обложка глянца", "style_vogue").row()
    .text("🏰 Княгиня (Мирский)", "style_castle").row()
    .text("🎁 Купить в подарок", "buy_gift").row()
    .text("❓ Как это работает?", "help_info");
};

export const getPaymentKeyboard = (styleCode: string) => {
  return new InlineKeyboard().text("✅ Я оплатил(а)", `paid_${styleCode}`);
};

export const getGiftPaymentKeyboard = () => {
  return new InlineKeyboard().text("✅ Я оплатил подарок", "paid_gift");
};

export const getBackToMainKeyboard = () => {
  return new InlineKeyboard().text("◀️ Назад в меню", "back_to_main");
};

export const getProfileKeyboard = (hasGenerations: boolean) => {
  const kb = new InlineKeyboard();
  if (hasGenerations) {
    kb.text("✨ Сгенерировать фото", "create_photo");
  }
  return kb;
};

export const getPostGenerationKeyboard = (styleCode: string, hasGenerations: boolean) => {
  const kb = new InlineKeyboard();
  if (hasGenerations) {
    kb.text("🔄 Сгенерировать еще в этом стиле", `generate_more_${styleCode}`).row();
  }
  kb.text("🎨 Выбрать другой стиль", "back_to_main");
  return kb;
};
