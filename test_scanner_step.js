// Test step-by-step why scanTrueFalseStatements might fail on Edux DOM

// 1. Let's inspect the text of the button
const buttonText = "Đúng";
const clean = buttonText.normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
console.log('clean buttonText:', clean);
console.log('isTrue regex:', /^(?:\(?\s*(?:đúng|true|đ)\s*\)?[\:\.]?|1[\.\:\)]\s*đúng)$/i.test(clean));

// 2. What about the question header check:
const headerText = "Câu 23 Đúng sai : Đánh giá các phát biểu về continuous integration trong phát triển phần mềm:";
console.log('Regex with \\b:', /(?:\bđúng[\s\/\-]*sai\b|\btrue[\s\/\-]*false\b|chọn\s+đúng\s+hoặc\s+sai)/i.test(headerText.normalize('NFC')));
console.log('Regex without \\b:', /(?:đúng[\s\/\-]*sai|true[\s\/\-]*false|chọn\s+đúng\s+hoặc\s+sai)/i.test(headerText.normalize('NFC')));
