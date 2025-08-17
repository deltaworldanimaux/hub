require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "❌ MongoDB connection error:"));
db.once("open", () => console.log("✅ Connected to MongoDB Atlas"));

// ----- MODELS -----
const StoreSchema = new mongoose.Schema({
  storeId: { type: String, required: true, unique: true },
  storeName: { type: String, required: true },
  products: { type: Array, default: [] },
  clients: { type: Array, default: [] },
  orders: { type: Array, default: [] },
});

const Store = mongoose.model("Store", StoreSchema);

// ----- ROUTES -----

// 1. Store pushes products
app.post("/sync/products/:storeId", async (req, res) => {
  const { storeId } = req.params;
  await Store.updateOne(
    { storeId },
    { $set: { products: req.body } },
    { upsert: true }
  );
  res.json({ success: true });
});

// 2. Clients get products
app.get("/products/:storeId", async (req, res) => {
  const store = await Store.findOne({ storeId: req.params.storeId });
  res.json(store?.products || []);
});

// Get all stores
app.get("/stores", async (req, res) => {
  try {
    const stores = await Store.find({}, 'storeId storeName');
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: "Error fetching stores" });
  }
});
// 3. Client places an order
app.post("/orders/:storeId", async (req, res) => {
  const { storeId } = req.params;
  const order = req.body;

  const store = await Store.findOneAndUpdate(
    { storeId },
    { $push: { orders: order } },
    { new: true, upsert: true }
  );

  res.json({ success: true, order });
});

app.delete("/orders/:storeId/:orderId", async (req, res) => {
  const { storeId, orderId } = req.params;
  
  await Store.updateOne(
    { storeId },
    { $pull: { orders: { id: orderId } } }
  );
  
  res.json({ success: true });
});
// 4. Store pulls new orders
app.get("/sync/orders/:storeId", async (req, res) => {
  const store = await Store.findOne({ storeId: req.params.storeId });
  res.json(store?.orders || []);
});

// 5. Store clears processed orders (optional)
app.post("/sync/orders/:storeId/clear", async (req, res) => {
  const { storeId } = req.params;
  await Store.updateOne({ storeId }, { $set: { orders: [] } });
  res.json({ success: true });
});

// health check
app.get("/", (req, res) => {
  res.send("Hub API is running ✅");
});

app.use(express.static("public"));

// ----- START -----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Hub running on port ${PORT}`));
