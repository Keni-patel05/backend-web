const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

const app = express();
const jwtKey = "e-comm";

// MongoDB connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("DB connected"))
  .catch(err => console.log("MongoDB connection error:", err));

// Models and Config
require("./db/config"); // optional if it's needed elsewhere
const User = require("./db/User");
const Product = require("./db/Product");

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads')); // Serve uploaded images

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// JWT token generation
const generateToken = (user) => {
  return jwt.sign(
    { user: { _id: user._id, isAdmin: user.isAdmin || false } },
    jwtKey,
    { expiresIn: "2h" }
  );
};

// JWT middleware
const verifyToken = (req, res, next) => {
  let token = req.headers["authorization"];
  if (token) {
    const parts = token.split(" ");
    token = parts.pop();
    jwt.verify(token, jwtKey, (err, valid) => {
      if (err) return res.status(401).send({ result: "Invalid token" });
      next();
    });
  } else {
    res.status(403).send({ result: "Token required" });
  }
};

// Routes
app.post("/register", async (req, res) => {
  try {
    const user = new User(req.body);
    let result = await user.save();
    result = result.toObject();
    delete result.password;
    const token = generateToken(result);
    res.send({ user: result, auth: token });
  } catch (error) {
    res.status(500).send({ result: "Registration Failed", error });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    let user = await User.findOne({ email, password }).select("-password");
    if (user) {
      const token = generateToken(user);
      res.send({ user, auth: token });
    } else {
      res.status(401).send({ result: "No User Found" });
    }
  } else {
    res.status(400).send({ result: "Please fill out all mandatory fields" });
  }
});

// Add product
app.post("/add-product", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { product, price, category, company, userId } = req.body;
    const image = req.file ? req.file.filename : "";
    const newProduct = new Product({ product, price, category, company, userId, image });
    const result = await newProduct.save();
    res.status(200).json(result);
  } catch (err) {
    console.error("Error in /add-product:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

app.get("/products", verifyToken, async (req, res) => {
  try {
    const token = req.headers["authorization"].split(" ")[1];
    const decoded = jwt.verify(token, jwtKey);
    const userId = decoded.user._id;
    const isAdmin = decoded.user.isAdmin;

    let products = isAdmin ? await Product.find() : await Product.find({ userId });
    res.send(products);
  } catch (err) {
    res.status(401).send({ message: "Invalid token or unauthorized" });
  }
});

app.delete("/product/:id", verifyToken, async (req, res) => {
  const result = await Product.deleteOne({ _id: req.params.id });
  res.send(result);
});

app.get("/product/:id", verifyToken, async (req, res) => {
  const result = await Product.findOne({ _id: req.params.id });
  res.send(result || { result: "No Record Found" });
});

app.put("/product/:id", verifyToken, async (req, res) => {
  const result = await Product.updateOne(
    { _id: req.params.id },
    { $set: req.body }
  );
  res.send(result);
});

app.get("/search/:key", verifyToken, async (req, res) => {
  const result = await Product.find({
    $or: [
      { product: { $regex: req.params.key, $options: "i" } },
      { company: { $regex: req.params.key, $options: "i" } },
      { category: { $regex: req.params.key, $options: "i" } },
    ],
  });
  res.send(result);
});

// Admin auto-creation
const createDefaultAdmin = async () => {
  const existing = await User.findOne({ email: "admin@example.com" });
  if (!existing) {
    const admin = new User({
      name: "Admin",
      email: "adm@example.com",
      password: "jkl@123",
      isAdmin: true
    });
    await admin.save();
  }
};
createDefaultAdmin();

// Start server on env PORT or 5000
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});
