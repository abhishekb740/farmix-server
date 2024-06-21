const express = require("express");
const app = express();
const { client } = require("./utils/Covalent/covalent");

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})