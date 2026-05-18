const fs = require("fs");
const path = require("path");

const CSV_PATH = "/Users/alexandernieves/Desktop/pos/VENTAS.xlsx - Hoja1.csv";
const OUTPUT_PATH = "/Users/alexandernieves/Desktop/pos/VENTAS.xlsx - Hoja1.csv"; // Overwrite the same file

function cleanNumber(str) {
  if (!str) return 0;
  // Remove currency signs explicitly, then strip quotes and whitespace
  let cleaned = str.replace(/Bs\.S/gi, "")
                   .replace(/Bs/gi, "")
                   .replace(/[\$\s]/g, "")
                   .replace(/"/g, "")
                   .trim();
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // e.g. 1.315,00 -> 1315.00
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // e.g. 1,30 -> 1.30
    cleaned = cleaned.replace(",", ".");
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function getCategory(name) {
  const n = name.toUpperCase();
  if (
    n.includes("PILA") || n.includes("PILLA") || n.includes("BOMBILLO") || n.includes("BONBILLO") || 
    n.includes("LAMPARA") || n.includes("REGLETA") || n.includes("RECLETA") || n.includes("TEIPE ELECTRICO") || 
    n.includes("TOMACORRIENTE") || n.includes("APAGADOR") || n.includes("SOCATE") || n.includes("CABLE") || 
    n.includes("REFLECTOR") || n.includes("ENCHUFE") || n.includes("TEIPE") || n.includes("TEFLON") || 
    n.includes("PROTECTOR 110") || n.includes("PROTECTOR 220") || n.includes("PROTECROR") || 
    n.includes("CANDADO") || n.includes("HOJILLAS") || n.includes("LIJAS") || n.includes("PEGA TANQUE")
  ) {
    return "Ferretería y Electricidad";
  }
  if (
    n.includes("SUAVITEL") || n.includes("AXION") || n.includes("AJAX") || n.includes("FABULOSO") || 
    n.includes("ALIVE") || n.includes("VANISH") || n.includes("JABON 3B") || n.includes("OXY") || 
    n.includes("BONA ROPA") || n.includes("CLORO") || n.includes("DESINFECTANTE") || n.includes("LAVAPLATOS") || 
    n.includes("DESENGRASANTE") || n.includes("MAS LIMPIA POCETA") || n.includes("DIABLO ROJO") || 
    n.includes("LIMPIA HORNO") || n.includes("GLADE") || n.includes("JABON EVERY NIGHT") || n.includes("JABON BRISOL") ||
    n.includes("JABON MONCLEAR") || n.includes("JABON BLANQUEADOR") || n.includes("JABON ARIEL")
  ) {
    return "Limpieza y Cuidado del Hogar";
  }
  if (
    n.includes("COLGATE") || n.includes("CEPILLO DE DIENTE") || n.includes("JABON PROTEX") || 
    n.includes("PALMOLIVE") || n.includes("LEMON") || n.includes("ESPUMA DE AFEITAR") || 
    n.includes("AFEITADORA") || n.includes("SHAMPO") || n.includes("CHAMPU") || n.includes("ACONDICIONADOR") || 
    n.includes("CREMA DE PEINAR") || n.includes("LOCION") || n.includes("TALCO") || n.includes("DESODORANTE") || 
    n.includes("VASELINA") || n.includes("TOALLAS SANITARIAS") || n.includes("HILOS DENTAL") || 
    n.includes("ENJUEGUE BOCAL") || n.includes("HISOPOS") || n.includes("GUANTES DE NITRILO") || 
    n.includes("JABON HUO") || n.includes("JABON NATURAL") || n.includes("JABON ESPECIAL") || 
    n.includes("JABON LAS LLAVES") || n.includes("BOROCABFOR") || n.includes("TOCIMIEL") || 
    n.includes("CREMA NOVEX") || n.includes("HISOPO")
  ) {
    return "Cuidado Personal";
  }
  if (
    n.includes("TERMOMETRO") || n.includes("JERINGA") || n.includes("RECOLECTOR DE ORINA") || 
    n.includes("RECOLECTOR DE ECES") || n.includes("GAZAS") || n.includes("ALKA SELZER") || 
    n.includes("ALGODÓN") || n.includes("ALCOHOL") || n.includes("VAPORUT") || n.includes("VAPORUB") ||
    n.includes("CONDON") || n.includes("TAPA BOCA")
  ) {
    return "Salud y Farmacia";
  }
  if (
    n.includes("PAPEL ROSAL") || n.includes("TOALLIN") || n.includes("TOALLITAS AMY")
  ) {
    return "Desechables y Papelería del Hogar";
  }
  if (
    n.includes("PALA") || n.includes("RASTRILLO") || n.includes("ESCOBA") || n.includes("LAMPAZO") || 
    n.includes("PONCHERA") || n.includes("TOBO") || n.includes("CHUPA SANITARIA") || 
    n.includes("CEPILLAVALINYEO SANITARIA")
  ) {
    return "Limpieza y Organización Mayor";
  }
  if (
    n.includes("COLADOR DE CAFÉ") || n.includes("JARRAS") || n.includes("POTE DE COCINA") || 
    n.includes("TAZAS") || n.includes("EXPRIMIDOR") || n.includes("CUCHARAS") || n.includes("TENEDOR") || 
    n.includes("VASOS PLASTICO") || n.includes("CUCHRAS PLASTICAS") || n.includes("COLADOR DE JUGO") ||
    n.includes("COLADOR DE PASTA")
  ) {
    return "Cocina y Menaje";
  }
  if (
    n.includes("TINTE") || n.includes("DECOLORANTE") || n.includes("MASCARRILLA CAPILAR") || 
    n.includes("CEPILLO SECADOR") || n.includes("POLVO ACRILICO") || n.includes("CERA MIEL") || 
    n.includes("ESMALTE") || n.includes("ACETONA") || n.includes("CORTA CUTICULAS") || 
    n.includes("LIMAS DE UNAS") || n.includes("PESTANAS") || n.includes("TINTA CHINA") || 
    n.includes("LABIAL") || n.includes("PEGA PESTANA") || n.includes("GORRO PARA CABELLO") || 
    n.includes("BASE PARA ROSTRO") || n.includes("RUBOR") || n.includes("COMPACTO MONREY") || 
    n.includes("PROTECTOR SOLAR") || n.includes("ACEITE CAPILAR") || n.includes("CREMA PONS") || 
    n.includes("PRAIME") || n.includes("SERUM") || n.includes("CORTA UNAS") || n.includes("PEINE") ||
    n.includes("PEINAR") || n.includes("ZARCILLOS") || n.includes("ARGOLLAS") || n.includes("CADENAS") || 
    n.includes("JUEGO DE CADENA") || n.includes("MOPAS DESMAQUILLANTES") || n.includes("MONOMERO") ||
    n.includes("KIT DEV LIGAS") || n.includes("KIT PEDICURE") || n.includes("LAPIZ LABIAL")
  ) {
    return "Cosmética y Belleza";
  }
  if (
    n.includes("RELOJ") || n.includes("MONEDERO") || n.includes("GORRAS") || n.includes("PARAGUAS") || 
    n.includes("COHALA") || n.includes("BOLSO") || n.includes("CARTERA") || n.includes("LENTES") ||
    n.includes("LIGAS DE CABELLO") || n.includes("GANCHO CABELLO") || n.includes("GANCHOS NEGROS") ||
    n.includes("GANCHO DE CLOSET")
  ) {
    return "Moda y Accesorios";
  }
  if (
    n.includes("MARCADOR") || n.includes("LAPIZ") || n.includes("COLORES") || n.includes("SACAPUNTA") || 
    n.includes("BORRADOR") || n.includes("SILICON") || n.includes("TIJERA") || n.includes("HOJAS") || 
    n.includes("CARPETA") || n.includes("CARTULINA") || n.includes("FOAMI") || n.includes("CUADERNOS") || 
    n.includes("RESALTADOR") || n.includes("CINTA DOBLE CARA") || n.includes("ESCARCHA") || 
    n.includes("HOJAS BLANCA") || n.includes("PINTURA AL FRIO") || n.includes("TEMPERA") ||
    n.includes("CINTA") || n.includes("PALILLOS") || n.includes("VELAS PEQUENA") || n.includes("CREYON") ||
    n.includes("CREYONES") || n.includes("AGUJAS DE COSER") || n.includes("HILOS DE COSER")
  ) {
    return "Papelería y Oficina";
  }
  if (
    n.includes("CAJAS DE REGALO") || n.includes("BOLSITA DE REGALO") || n.includes("CAJITA DE REGALO") || 
    n.includes("GLOBOS") || n.includes("CORTINA DE REGALO") || n.includes("FLOTADOR DE GLOBOS")
  ) {
    return "Regalos y Fiestas";
  }
  if (
    n.includes("JUGUETE") || n.includes("LEGO") || n.includes("CARRO DE DINOSAURIO") || 
    n.includes("ROMPECABEZA") || n.includes("PELOTAS") || n.includes("BOLTEO DE JUGUETE")
  ) {
    return "Juguetería";
  }
  if (
    n.includes("PLATANITOS") || n.includes("CHISKESITO") || n.includes("CHISTOZO") || 
    n.includes("PALITOS") || n.includes("MASMELOS") || n.includes("DANDY") || n.includes("TRIDENT") || 
    n.includes("MAXCOCO") || n.includes("WAFER") || n.includes("RULITAS") || n.includes("CHUPETAS") || 
    n.includes("FREEGLLESS") || n.includes("GALLETA") || n.includes("MILLOWS") || 
    n.includes("MARRSHMALLOWS") || n.includes("MANI MOTO") || n.includes("CHICLE") || 
    n.includes("TRULULU") || n.includes("BIANCHI") || n.includes("TURRON") || n.includes("NUCITA") || 
    n.includes("DORITO") || n.includes("POPETAS") || n.includes("SORBETICOS") || n.includes("PIAZZA") || 
    n.includes("SPACE POP") || n.includes("PLANET CRONCH") || n.includes("ROCKET PLANET") || 
    n.includes("GRISSLY") || n.includes("BRINKI") || n.includes("BOCADILLOS") || n.includes("RAPIDO QUESO")
  ) {
    return "Snacks y Confitería";
  }
  if (
    n.includes("LLUVIA DE CHOCOLATE") || n.includes("LLUVIA DE COLORES") || n.includes("MESCLA PARA TORTA") || 
    n.includes("BALINES DE COLORES") || n.includes("CACAO") || n.includes("CEREZA ROJA") || 
    n.includes("FRUTA CONFITADA") || n.includes("NEVATORTA") || n.includes("SANTILLY") || 
    n.includes("COLOR EN GEL") || n.includes("BASE DE TORTA") || n.includes("BASE TRIANGULAR") || 
    n.includes("BASE DE ALUMINIO") || n.includes("COLORETI")
  ) {
    return "Repostería";
  }
  return "General";
}

function getPrefix(category) {
  switch (category) {
    case "Ferretería y Electricidad": return "FER";
    case "Limpieza y Cuidado del Hogar": return "LIM";
    case "Cuidado Personal": return "CP";
    case "Salud y Farmacia": return "SAL";
    case "Desechables y Papelería del Hogar": return "DES";
    case "Limpieza y Organización Mayor": return "LOM";
    case "Cocina y Menaje": return "COC";
    case "Cosmética y Belleza": return "COS";
    case "Moda y Accesorios": return "MOD";
    case "Papelería y Oficina": return "PAP";
    case "Regalos y Fiestas": return "REG";
    case "Juguetería": return "JUG";
    case "Snacks y Confitería": return "SNA";
    case "Repostería": return "REP";
    default: return "GEN";
  }
}

function isWeighableProduct(name) {
  const n = name.trim().toUpperCase();
  const weighableList = [
    "CLORO", 
    "DESINFECTANTE", 
    "SUAVIZANTE", 
    "CLORO JABONOSO", 
    "DESENGRASANTE", 
    "LAVAPLATOS",
    "JABON LAVAPLATOS",
    "CERA BLANCA",
    "DESTAPADOR DE CANERIA"
  ];
  return weighableList.some(item => n === item || n.startsWith(item));
}

function getDescription(name, category) {
  return `${name} - Categoría: ${category}. Producto seleccionado bajo estrictos estándares de calidad.`;
}

function run() {
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const lines = content.split("\n");

  const headers = lines[0].split(",");
  const products = [];
  let barcodeCounter = 7591000000001;
  let skuCounter = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV split with quotes for price
    let parts = [];
    let insideQuote = false;
    let currentPart = "";

    for (let char of line) {
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        parts.push(currentPart);
        currentPart = "";
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart);

    const name = parts[0]?.trim();
    if (!name || name === "Nombre del producto" || name.startsWith(",,,") || name === "") continue;

    let costStr = parts[2]?.trim() || "0";
    let cost = cleanNumber(costStr);

    // Fallback if cost is zero but there is a price in Bs
    if (cost === 0 && parts[3]) {
      const bsPrice = cleanNumber(parts[3]);
      if (bsPrice > 0) {
        cost = parseFloat((bsPrice / 263).toFixed(2));
      }
    }

    // Default cost fallback if still 0
    if (cost === 0) {
      cost = 1.50;
    }

    const bcvRate = 515.18;
    const priceUsd = parseFloat((cost * 1.30).toFixed(2));
    const priceBs = parseFloat((priceUsd * bcvRate).toFixed(2));

    const category = getCategory(name);
    const prefix = getPrefix(category);

    skuCounter[prefix] = (skuCounter[prefix] || 0) + 1;
    const sku = `${prefix}-${String(skuCounter[prefix]).padStart(3, "0")}`;

    const barcode = String(barcodeCounter++);
    const isWeighable = isWeighableProduct(name) ? 1 : 0;
    const description = getDescription(name, category);
    const stock = 10; // Default stock

    products.push({
      Nombre: name,
      Costo_USD: cost,
      Precio_USD: priceUsd,
      Precio_Bs: priceBs,
      Stock: stock,
      SKU: sku,
      Codigo_Barras: barcode,
      Categoria: category,
      Pesable: isWeighable,
      Descripcion: description
    });
  }

  // Generate the formatted CSV content
  const outputHeaders = ["Nombre", "Costo_USD", "Precio_USD", "Precio_Bs", "Stock", "SKU", "Codigo_Barras", "Categoria", "Pesable", "Descripcion"];
  const csvLines = [outputHeaders.join(",")];

  for (const p of products) {
    const row = [
      `"${p.Nombre.replace(/"/g, '""')}"`,
      p.Costo_USD.toFixed(2),
      p.Precio_USD.toFixed(2),
      p.Precio_Bs.toFixed(2),
      p.Stock,
      p.SKU,
      p.Codigo_Barras,
      `"${p.Categoria}"`,
      p.Pesable,
      `"${p.Descripcion.replace(/"/g, '""')}"`
    ];
    csvLines.push(row.join(","));
  }

  fs.writeFileSync(OUTPUT_PATH, csvLines.join("\n"), "utf8");
  console.log(`Processed ${products.length} products successfully! CSV written to ${OUTPUT_PATH}`);
}

run();
