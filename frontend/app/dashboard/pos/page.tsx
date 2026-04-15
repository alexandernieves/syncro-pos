"use client";

import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { IconShoppingCart, IconTrash, IconSearch, IconCash, IconCreditCard, IconPlus, IconMinus } from "@tabler/icons-react";
import { toast } from "sonner";

// Datos de prueba (MOCK)
const MOCK_PRODUCTS = [
  { id: 1, name: "Café Expréso", category: "Bebidas", price: 2.50, image: "☕" },
  { id: 2, name: "Capuchino", category: "Bebidas", price: 3.50, image: "☕" },
  { id: 3, name: "Chocolate Caliente", category: "Bebidas", price: 3.00, image: "🍫" },
  { id: 4, name: "Té Verde", category: "Bebidas", price: 2.00, image: "🍵" },
  { id: 5, name: "Croissant", category: "Comida", price: 1.50, image: "🥐" },
  { id: 6, name: "Donut de Chocolate", category: "Comida", price: 1.80, image: "🍩" },
  { id: 7, name: "Tarta de Manzana", category: "Postres", price: 4.00, image: "🥧" },
  { id: 8, name: "Galleta de Avena", category: "Comida", price: 1.20, image: "🍪" },
  { id: 9, name: "Sándwich de Pavo", category: "Comida", price: 5.50, image: "🥪" },
  { id: 10, name: "Jugo de Naranja", category: "Bebidas", price: 2.80, image: "🧃" },
  { id: 11, name: "Pastel de Zanahoria", category: "Postres", price: 4.50, image: "🍰" },
  { id: 12, name: "Ensalada César", category: "Comida", price: 6.00, image: "🥗" },
];

type CartItem = {
  product: typeof MOCK_PRODUCTS[0];
  quantity: number;
};

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = MOCK_PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: typeof MOCK_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const processPayment = (method: string) => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    toast.success(`Pago procesado exitosamente vía ${method}`);
    setCart([]); // Limpiar carrito
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const tax = subtotal * 0.16; // 16% IVA
  const total = subtotal + tax;

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 p-4 lg:p-6 bg-muted/20">
      
      {/* SECCIÓN IZQUIERDA: PRODUCTOS */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Barra de Búsqueda */}
        <Card className="shadow-xs border-0 bg-background/50 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-3">
            <IconSearch className="text-muted-foreground" />
            <Input 
              placeholder="Buscar productos por nombre..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-lg px-0"
            />
          </CardContent>
        </Card>

        {/* Rejilla de Productos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-20">
          {filteredProducts.map(product => (
            <Card 
              key={product.id} 
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all active:scale-95 group overflow-hidden"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                <div className="text-5xl group-hover:scale-110 transition-transform">{product.image}</div>
                <div>
                  <p className="font-semibold text-sm leading-tight mb-1">{product.name}</p>
                  <p className="text-primary font-bold">${product.price.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground flex flex-col items-center">
              <IconSearch className="size-12 mb-4 opacity-20" />
              <p>No se encontraron productos con ese nombre.</p>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DERECHA: CARRITO Y PAGO */}
      <Card className="w-full lg:w-[400px] flex flex-col h-full shadow-lg border-0 bg-background/80 backdrop-blur-xl">
        <CardHeader className="pb-4 shrink-0">
          <CardTitle className="flex items-center gap-2">
            <IconShoppingCart className="text-primary" />
            Ticket Actual
          </CardTitle>
          <CardDescription>
            {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'} en el carrito
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto px-6 py-0 pb-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-50 py-12">
              <IconShoppingCart size={64} className="stroke-[1.5]" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm leading-none mb-1">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">${item.product.price.toFixed(2)} / ud</p>
                    </div>
                    <p className="font-bold">${(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center bg-muted rounded-md overflow-hidden">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-background/50" onClick={() => updateQuantity(item.product.id, -1)}>
                        <IconMinus size={14} />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-background/50" onClick={() => updateQuantity(item.product.id, 1)}>
                        <IconPlus size={14} />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeFromCart(item.product.id)}>
                      <IconTrash size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <div className="shrink-0 p-6 pt-0 mt-auto bg-background/95 backdrop-blur-sm">
          <Separator className="my-4" />
          <div className="flex flex-col gap-2 mb-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IVA (16%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-xl mt-1">
              <span>Total</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              size="lg" 
              variant="outline" 
              className="h-14 font-semibold text-base gap-2"
              onClick={() => processPayment("Efectivo")}
              disabled={cart.length === 0}
            >
              <IconCash className="size-5" />
              Efectivo
            </Button>
            <Button 
              size="lg" 
              className="h-14 font-semibold text-base gap-2"
              onClick={() => processPayment("Tarjeta")}
              disabled={cart.length === 0}
            >
              <IconCreditCard className="size-5" />
              Tarjeta
            </Button>
          </div>
        </div>
      </Card>
      
    </div>
  );
}
