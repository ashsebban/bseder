import { toIsoDate } from "@/lib/date";

export interface DailyQuote {
  text: string;
  attribution: string;
  source?: string;
}

export const ENCOURAGEMENT_CATALOG: DailyQuote[] = [
  // Lubavitcher Rebbe
  {
    text: "A little light dispels a lot of darkness.",
    attribution: "Lubavitcher Rebbe",
  },
  {
    text: "Think good and it will be good.",
    attribution: "Lubavitcher Rebbe",
  },
  {
    text: "No matter how many times you fall, you get up one more time.",
    attribution: "Lubavitcher Rebbe",
  },
  {
    text: "The world was created for my sake — therefore I have a duty to fill it with goodness.",
    attribution: "Lubavitcher Rebbe",
  },
  {
    text: "Every Jew is a living letter in the Torah of the Infinite.",
    attribution: "Lubavitcher Rebbe",
  },

  // Rambam
  {
    text: "A person must see himself and the world as equally balanced between merit and sin — one good deed can tip the scales.",
    attribution: "Rambam (Maimonides)",
    source: "Hilchot Teshuvah 3:4",
  },
  {
    text: "The risk of a wrong decision is preferable to the terror of indecision.",
    attribution: "Rambam (Maimonides)",
  },
  {
    text: "Teach your tongue to say 'I do not know,' lest you invent something and be caught.",
    attribution: "Rambam (Maimonides)",
  },
  {
    text: "Strengthen yourself like a lion to rise in the morning for the service of your Creator.",
    attribution: "Rambam (Maimonides)",
    source: "Mishneh Torah, Hilchot Deot 1:4",
  },

  // Rebbe Nachman of Breslov
  {
    text: "The whole world is a very narrow bridge, and the main thing is not to be afraid at all.",
    attribution: "Rebbe Nachman of Breslov",
  },
  {
    text: "It is a great mitzvah to be happy always.",
    attribution: "Rebbe Nachman of Breslov",
    source: "Likutei Moharan II, 24",
  },
  {
    text: "If you're not going to be better tomorrow than you are today, then what need have you for tomorrow?",
    attribution: "Rebbe Nachman of Breslov",
  },
  {
    text: "You are never alone — God is always with you.",
    attribution: "Rebbe Nachman of Breslov",
  },
  {
    text: "A sigh breaks half the body — but a joyful heart is good medicine.",
    attribution: "Rebbe Nachman of Breslov",
  },

  // Baal Shem Tov
  {
    text: "From every human being there rises a light that reaches straight to heaven.",
    attribution: "Baal Shem Tov",
  },
  {
    text: "You are wherever your thoughts are — make sure your thoughts are where you want to be.",
    attribution: "Baal Shem Tov",
  },
  {
    text: "For every fall there is a reason — and after every fall there is a greater rising.",
    attribution: "Baal Shem Tov",
  },
  {
    text: "God does not look at the greatness of the deed, but at the greatness of the heart.",
    attribution: "Baal Shem Tov",
  },

  // Hillel
  {
    text: "If I am not for myself, who will be for me? And if I am only for myself, what am I? And if not now, when?",
    attribution: "Hillel",
    source: "Pirkei Avot 1:14",
  },
  {
    text: "In a place where there are no men, strive to be a man.",
    attribution: "Hillel",
    source: "Pirkei Avot 2:5",
  },
  {
    text: "Be of the disciples of Aaron — love peace and pursue peace.",
    attribution: "Hillel",
    source: "Pirkei Avot 1:12",
  },

  // Ben Zoma
  {
    text: "Who is wise? One who learns from every person.",
    attribution: "Ben Zoma",
    source: "Pirkei Avot 4:1",
  },
  {
    text: "Who is mighty? One who conquers his evil inclination.",
    attribution: "Ben Zoma",
    source: "Pirkei Avot 4:1",
  },
  {
    text: "Who is rich? One who is satisfied with his portion.",
    attribution: "Ben Zoma",
    source: "Pirkei Avot 4:1",
  },
  {
    text: "Who is honored? One who honors all people.",
    attribution: "Ben Zoma",
    source: "Pirkei Avot 4:1",
  },

  // Vilna Gaon
  {
    text: "The main purpose of life is to continuously improve, for that is why we were created.",
    attribution: "Vilna Gaon",
  },
  {
    text: "The greatest disease of the soul is the habit of wasting time.",
    attribution: "Vilna Gaon",
  },

  // Chofetz Chaim
  {
    text: "Do not worry about tomorrow's troubles, for you do not know what tomorrow will bring. Perhaps tomorrow you will not be here, and you will have worried about a world that is not yours.",
    attribution: "Chofetz Chaim",
  },
  {
    text: "Every word of Torah that you study is a gem placed in your eternal crown.",
    attribution: "Chofetz Chaim",
  },

  // Rav Kook
  {
    text: "The pure righteous do not complain of the dark, but increase the light.",
    attribution: "Rav Kook",
    source: "Arpelei Tohar",
  },
  {
    text: "Out of love we must illuminate the darkness.",
    attribution: "Rav Kook",
  },
  {
    text: "The whole world is created for the sake of a single soul — thus every soul uplifts the world.",
    attribution: "Rav Kook",
  },

  // Ramchal
  {
    text: "The foundation of saintliness is for a person to clarify and take to heart that his duty in this world is none other than to fulfill the commandments of God.",
    attribution: "Ramchal (Rabbi Moshe Chaim Luzzatto)",
    source: "Messilat Yesharim, ch. 1",
  },

  // Classical / Talmudic
  {
    text: "Even if a sharp sword rests on a man's neck, he should not desist from prayer.",
    attribution: "Talmud",
    source: "Berakhot 10a",
  },
  {
    text: "He who saves a single soul, Scripture accounts it as if he had saved an entire world.",
    attribution: "Talmud",
    source: "Sanhedrin 37a",
  },
  {
    text: "A person's feet are his guarantors — they lead him where he is meant to go.",
    attribution: "Talmud",
    source: "Sukkah 53a",
  },
];

export function getDailyEncouragement(date: Date = new Date()): DailyQuote {
  const iso = toIsoDate(date);
  const hash = iso.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return ENCOURAGEMENT_CATALOG[hash % ENCOURAGEMENT_CATALOG.length]!;
}
