const bcrypt = require("bcrypt");

async function hashPassword() {
    const password = "doctor123";

    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Hashed password:");
    console.log(hashedPassword);
}

hashPassword();