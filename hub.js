require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// CORS Configuration
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "❌ MongoDB connection error:"));
db.once("open", () => console.log("✅ Connected to MongoDB Atlas"));

// Store Schema
const StoreSchema = new mongoose.Schema({
  storeId: { type: String, required: true, unique: true },
  storeName: { type: String, required: true },
  products: { type: Array, default: [] },
  orders: { type: Array, default: [] },
}, { timestamps: true });

const Store = mongoose.model("Store", StoreSchema);

// ----- Fixed Routes (removed extra quotes) -----

// Get all stores
app.get("/api/stores", async (req, res) => {
  try {
    const stores = await Store.find({}, 'storeId storeName');
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: "Error fetching stores" });
  }
});

// Store pushes products
app.post("/api/sync/products/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    await Store.updateOne(
      { storeId },
      { $set: { 
        products: req.body.products,
        storeName: req.body.storeName 
      }},
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error syncing products" });
  }
});

// Clients get products
app.get("/api/products/:storeId", async (req, res) => {
  try {
    const store = await Store.findOne({ storeId: req.params.storeId });
    res.json(store?.products || []);
  } catch (error) {
    res.status(500).json({ error: "Error fetching products" });
  }
});

// Client places an order
app.post("/api/orders/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    const order = req.body;

    await Store.updateOne(
      { storeId },
      { $push: { orders: order } },
      { upsert: true }
    );

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: "Error placing order" });
  }
});

// Store pulls new orders
app.get("/api/sync/orders/:storeId", async (req, res) => {
  try {
    const store = await Store.findOne({ storeId: req.params.storeId });
    res.json(store?.orders || []);
  } catch (error) {
    res.status(500).json({ error: "Error fetching orders" });
  }
});

// Delete specific order
app.delete("/api/orders/:storeId/:orderId", async (req, res) => {
  try {
    const { storeId, orderId } = req.params;
    await Store.updateOne(
      { storeId },
      { $pull: { orders: { id: orderId } } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error deleting order" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Hub API is running ✅");
});

app.use(express.static("public"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Hub running on port ${PORT}`));