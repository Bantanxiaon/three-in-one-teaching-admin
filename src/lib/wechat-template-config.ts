export const wechatTemplateDefaults = {
  bookingReceived: {
    templateId: "jTEHTqk5KkfpaAzmrRm1-NfjThIdqj1AD9Nfi4fXZyI",
    fields: {
      reference: "thing7",
      name: "thing10",
      status: "thing8"
    }
  },
  account: {
    templateId: "U4XRglQe__1H0geJKIr7PfVYR9hRQRImdeb47ra-40k",
    fields: {
      accountRef: "character_string34",
      name: "thing9",
      status: "phrase1",
      notice: "thing19"
    }
  },
  lesson: {
    templateId: "XuC-Fuxpgk6tIDF2Qcx2wX1QZXQThDzxbU5-bsx5rfQ",
    fields: {
      studentNumber: "character_string15",
      studentName: "thing21",
      teacherName: "name10",
      lessonTime: "date3",
      remainingLessons: "number91"
    }
  }
} as const;

export type WechatTemplateDefault = (typeof wechatTemplateDefaults)[keyof typeof wechatTemplateDefaults];
