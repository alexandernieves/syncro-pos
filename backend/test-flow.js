const API = "http://localhost:9000";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQG1pcG9zLmNvbSIsInN1YiI6IjA3ZTkxYTJhLTk1YzgtNDY4ZS05M2RmLTMyNjczYmQyYTk3NiIsInJvbGUiOiJvd25lcnBvcyIsIm5hbWUiOm51bGwsImNvdW50cnkiOiJWZW5lenVlbGEiLCJpYXQiOjE3NzY1NjE5NDMsImV4cCI6MTc3NjY0ODM0M30.-iyEgNrRJoHB8rn33USqLGP6epiKrCGVmwJhjz_QYE8";
const headers = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

async function logReq(url, method, body) {
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data;
  try { data = await res.json(); } catch(e) { data = await res.text(); }
  console.log(`\n=== ${method} ${url} ===\nStatus: ${res.status}\nResponse:`, JSON.stringify(data, null, 2));
  return { status: res.status, data };
}

async function runTest() {
  console.log("--> 1. Check/Open Shift");
  let shiftRes = await logReq("/shifts/active", "GET");
  let shiftData = shiftRes.data;
  
  if (shiftRes.status !== 200 || !shiftData || shiftData.status !== "OPEN") {
    console.log("No active shift. Opening one...");
    const openRes = await logReq("/shifts/open", "POST", { initialBalance: 100 });
    shiftData = openRes.data;
  }

  console.log("\n--> 2. Get Products (Inventory before)");
  const productsRes = await logReq("/products", "GET");
  const products = productsRes.data;
  if (!products || products.length === 0) {
    console.log("No products available to test. Please create a product first.");
    return;
  }
  
  const targetProduct = products[0];
  const targetVariant = targetProduct.variants && targetProduct.variants.length > 0 ? targetProduct.variants[0] : null;
  if (!targetVariant) {
    console.log("First product has no variants.");
    return;
  }

  console.log(`Selected Product: ${targetProduct.name} | Variant: ${targetVariant.sku} | Initial Stock: ${targetVariant.stock}`);

  console.log("\n--> 3. Execute Sale");
  const salePayload = {
    items: [
      {
        productId: targetProduct.id,
        variantId: targetVariant.id,
        name: targetProduct.name,
        price: targetVariant.price,
        quantity: 1,
        subtotal: targetVariant.price
      }
    ],
    payments: [
      {
        method: "CASH",
        amount: targetVariant.price,
        amountLocal: targetVariant.price * 480, // Faux local amount
        reference: "test-curl-run"
      }
    ],
    clientId: null
  };
  
  const saleRes = await logReq("/sales", "POST", salePayload);
  if (saleRes.status !== 201 && saleRes.status !== 200) {
    console.error("Sale failed! Aborting.");
    return;
  }

  console.log("\n--> 4. Get Products (Inventory After)");
  const afterProductsRes = await logReq("/products", "GET");
  const afterProduct = afterProductsRes.data.find(p => p.id === targetProduct.id);
  const afterVariant = afterProduct.variants.find(v => v.id === targetVariant.id);
  console.log(`Stock After Sale: ${afterVariant.stock} (Expected: ${targetVariant.stock - 1})`);
}

runTest().catch(console.error);
