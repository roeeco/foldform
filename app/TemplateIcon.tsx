import type { TemplateId } from "./lib/dieline";

type TemplateIconId = TemplateId | "cone" | "gift-box";
type Tone = "light" | "top" | "front" | "side";

const tone = (value: Tone) => ({ fill: `var(--template-${value})` });
const polygon = (points: string, fill: Tone) => <polygon points={points} {...tone(fill)} />;
const path = (d: string, fill: Tone) => <path d={d} {...tone(fill)} />;

export function TemplateIcon({ id }: { id: TemplateIconId }) {
  let art: React.ReactNode;
  switch (id) {
    case "tuck-end-carton": art = <>{polygon("16,17 38,8 48,14 27,23", "top")}{polygon("16,17 27,23 27,48 16,42", "front")}{polygon("27,23 48,14 48,39 27,48", "side")}{polygon("20,13 30,6 38,8 27,15", "light")}{polygon("27,15 38,8 43,11 32,18", "front")}</>; break;
    case "crash-lock-carton": art = <>{polygon("16,15 38,6 48,12 27,21", "top")}{polygon("16,15 27,21 27,47 16,41", "front")}{polygon("27,21 48,12 48,38 27,47", "side")}{polygon("16,35 27,40 27,47 16,41", "light")}{polygon("27,40 38,31 48,38 27,47", "side")}{polygon("27,40 16,35 25,30", "top")}</>; break;
    case "auto-lock-bottom": art = <>{polygon("16,15 38,6 48,12 27,21", "top")}{polygon("16,15 27,21 27,47 16,41", "front")}{polygon("27,21 48,12 48,38 27,47", "side")}{polygon("16,36 23,39 27,35 27,47 16,41", "light")}{polygon("27,35 33,39 40,31 48,38 27,47", "side")}{polygon("23,39 27,43 33,39 27,35", "top")}</>; break;
    case "box-with-lid": art = <>{polygon("9,23 31,14 54,22 31,32", "top")}{polygon("9,23 31,32 31,49 9,40", "front")}{polygon("31,32 54,22 54,39 31,49", "side")}{polygon("7,19 30,10 56,19 33,29", "light")}{polygon("7,19 33,29 33,33 7,23", "front")}{polygon("33,29 56,19 56,23 33,33", "side")}</>; break;
    case "match-box": art = <>{polygon("7,20 30,11 55,19 31,28", "side")}{polygon("7,20 31,28 31,46 7,38", "front")}{polygon("31,28 55,19 55,37 31,46", "side")}{polygon("17,25 39,17 51,21 29,30", "light")}{polygon("17,25 29,30 29,48 17,43", "top")}{polygon("29,30 51,21 51,39 29,48", "front")}</>; break;
    case "cake-slice-box": art = <>{polygon("10,41 31,11 54,39 31,49", "top")}{polygon("10,41 31,49 31,53 8,44", "front")}{polygon("31,49 54,39 54,44 31,53", "side")}{polygon("14,38 31,17 49,39 31,45", "light")}{polygon("31,45 49,39 54,41 31,51", "side")}</>; break;
    case "trapezoid-box": art = <>{polygon("18,19 39,10 52,17 30,26", "top")}{polygon("18,19 30,26 27,49 14,42", "front")}{polygon("30,26 52,17 48,40 27,49", "side")}{polygon("21,15 39,7 47,11 30,19", "light")}</>; break;
    case "bag": art = <>{path("M16 17h31l4 29-19 7-20-7 4-29z", "front")}{polygon("16,17 25,23 25,50 12,46", "light")}{polygon("39,23 47,17 51,46 39,50", "side")}{polygon("16,17 28,11 47,17 39,23 25,23", "top")}{path("M23 17V9c0-6 18-6 18 0v8h-4V9c0-2-10-2-10 0v8z", "side")}</>; break;
    case "envelope": art = <>{polygon("7,19 32,10 57,19 32,29", "light")}{polygon("7,19 32,29 32,49 7,40", "front")}{polygon("32,29 57,19 57,40 32,49", "side")}{polygon("11,22 32,38 53,22 53,38 32,46 11,38", "top")}</>; break;
    case "pillow-pack": art = <>{path("M16 15c9 5 23 5 32 0v29c-9-5-23-5-32 0V15z", "front")}{path("M16 15c-7 6-7 11 0 15v14c-7-6-7-11 0-15V15z", "light")}{path("M48 15c7 6 7 11 0 15v14c7-6 7-11 0-15V15z", "side")}{path("M20 18c7 3 17 3 24 0v5c-7 3-17 3-24 0v-5z", "top")}</>; break;
    case "cone": art = <>{path("M32 7 54 45 32 52 10 45 32 7z", "front")}{polygon("32,7 54,45 32,38", "side")}{path("M10 45c11-6 23-6 44 0l-22 7-22-7z", "top")}</>; break;
    case "gift-box": art = <>{polygon("9,23 32,14 55,23 32,33", "top")}{polygon("9,23 32,33 32,51 9,42", "front")}{polygon("32,33 55,23 55,42 32,51", "side")}{polygon("29,15 35,17 35,51 29,49", "light")}{polygon("9,23 32,33 32,38 9,28", "light")}{path("M32 14c-10-9-16-6-13-2 3 3 10 2 13 2zm0 0c10-9 16-6 13-2-3 3-10 2-13 2z", "top")}</>; break;
  }
  return <svg className="template-icon" viewBox="0 0 64 56" aria-hidden="true" focusable="false">{art}</svg>;
}
