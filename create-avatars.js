const fs = require("fs");
const path = require("path");

// Create simple placeholder avatar images
const createAvatar = (number) => {
  const svg = `
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="50" fill="#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}"/>
  <text x="50" y="60" text-anchor="middle" font-family="Arial" font-size="24" fill="white" font-weight="bold">${number}</text>
</svg>`;

  fs.writeFileSync(
    path.join(
      __dirname,
      "public",
      "avatars",
      `${number.toString().padStart(2, "0")}.svg`
    ),
    svg
  );
};

// Create 20 avatars
for (let i = 1; i <= 20; i++) {
  createAvatar(i);
}

console.log("Created 20 avatar files");






