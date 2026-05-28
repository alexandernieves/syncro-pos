"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet 
} from "@/components/ui/field";
import { 
  IconCrown, IconLock, IconDeviceFloppy, IconPhoto, IconShieldCheck, IconLoader2
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";

const API = API_URL;

const VENEZUELA_STATES = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo", 
  "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara", 
  "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre", 
  "Táchira", "Trujillo", "Vargas (La Guaira)", "Yaracuy", "Zulia"
];

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    country: "Venezuela",
    city: "",
    avatar: "",
    password: "",
    confirmPassword: ""
  });

  useEffect(() => {
    const loadUserData = async () => {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      
      if (storedUser && token) {
        const parsedUser = JSON.parse(storedUser);
        
        // If user ID is missing, fetch fresh data from backend
        if (!parsedUser.id) {
          try {
            const response = await fetch(`${API}/auth/session`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              // Try to get user by email since we don't have the ID
              const userResponse = await fetch(`${API}/users/email/${parsedUser.email}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (userResponse.ok) {
                const freshUserData = await userResponse.json();
                localStorage.setItem("user", JSON.stringify(freshUserData));
                setUser(freshUserData);
                setFormData({
                  name: freshUserData.name || "",
                  email: freshUserData.email || "",
                  country: "Venezuela",
                  city: freshUserData.city || "",
                  avatar: freshUserData.avatar || "",
                  password: "",
                  confirmPassword: ""
                });
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error("Error fetching fresh user data:", error);
          }
        }
        
        // Use stored data if ID exists or if fresh fetch failed
        setUser(parsedUser);
        setFormData({
          name: parsedUser.name || "",
          email: parsedUser.email || "",
          country: "Venezuela",
          city: parsedUser.city || "",
          avatar: parsedUser.avatar || "",
          password: "",
          confirmPassword: ""
        });
      }
      setLoading(false);
    };
    
    loadUserData();
  }, []);

  const handleUpdate = async () => {
    if (showPasswordFields && formData.password !== formData.confirmPassword) {
        toast.error("Las contraseñas no coinciden");
        return;
    }

    // Get user ID from stored data or use email as fallback
    const userId = user?.id || user?.email;
    
    if (!userId) {
        toast.error("Error: ID de usuario no encontrado");
        return;
    }

    setSubmitting(true);
    try {
      const updatePayload: any = {
        name: formData.name,
        country: formData.country,
        city: formData.city,
        avatar: formData.avatar
      };

      if (showPasswordFields && formData.password) {
          updatePayload.password = formData.password;
      }

      // Use email endpoint if ID is not available
      const endpoint = user?.id ? `${API}/users/${user.id}` : `${API}/users/email/${user.email}`;
      
      const token = localStorage.getItem("token");
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatePayload)
      });

      if (res.ok) {
        const updatedUser = await res.json();
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
        setShowPasswordFields(false);
        setFormData(prev => ({ ...prev, password: "", confirmPassword: "" }));
        toast.success("Perfil actualizado correctamente");
      }
    } catch (e) {
        console.error(e);
      toast.error("Error al actualizar perfil");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    // First, create a data URL for immediate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      console.log("Data URL created:", dataUrl.substring(0, 50) + "...");
      setFormData(prev => ({ ...prev, avatar: dataUrl }));
    };
    reader.readAsDataURL(file);

    // Then try to upload to server
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('email', user?.email || 'admin');

    try {
        const res = await fetch(`${API}/uploads`, {
            method: 'POST',
            body: formDataUpload
        });

        if (res.ok) {
            const { url } = await res.json();
            console.log("Uploaded image URL:", url);
            // Replace data URL with server URL after successful upload
            setFormData(prev => ({ ...prev, avatar: url }));
            toast.success("Imagen subida correctamente");
        } else {
            const errorData = await res.json().catch(() => ({}));
            console.error("Upload error:", errorData);
            toast.error("Error al subir la imagen, pero la imagen se guardó localmente");
        }
    } catch (err) {
        console.error("Upload error:", err);
        toast.error("Error de conexión al subir imagen, pero la imagen se guardó localmente");
    } finally {
        setUploading(false);
    }
  };

  if (loading) return null;

  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : "Reciente";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Compacto */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
          <p className="text-muted-foreground text-sm">Configuración de usuario maestro.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 font-bold text-amber-500 border-amber-500/20 bg-amber-500/5 uppercase tracking-widest text-[9px] rounded-full">
            <IconCrown size={12} className="mr-1.5" /> Enterprise
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Avatar & Summary (Compact) */}
        <div className="lg:col-span-4 space-y-4">
            <Card className="border shadow-none bg-muted/10">
                <CardHeader className="text-center p-4">
                    <div className="flex justify-center mb-3">
                        <div className="relative">
                            <Avatar key={formData.avatar} className="size-24 border-4 border-background shadow-md">
                                <AvatarImage 
                                    src={formData.avatar} 
                                    alt="Profile avatar"
                                    onError={(e) => {
                                        // Log error but let AvatarFallback handle it naturally
                                        console.log("Avatar image failed to load, showing fallback");
                                    }}
                                />
                                <AvatarFallback className="bg-primary/5 text-2xl font-black text-primary/30">
                                    {formData.name?.split(' ').map(word => word.charAt(0)).join('').substring(0,2).toUpperCase() || 'AD'}
                                </AvatarFallback>
                            </Avatar>
                            <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <Button 
                                size="icon" 
                                variant="secondary" 
                                disabled={uploading}
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 rounded-full size-7 border-2 border-background shadow-sm hover:scale-110 transition-transform"
                            >
                                {uploading ? <IconLoader2 className="animate-spin" size={12} /> : <IconPhoto size={12} />}
                            </Button>
                        </div>
                    </div>
                    <CardTitle className="text-xl font-bold">{formData.name || "Administrador"}</CardTitle>
                    <CardDescription className="font-mono text-[9px] uppercase tracking-widest text-primary mt-0.5">{user?.role || "OWNER"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-2">
                    <FieldGroup className="gap-2">
                        <Field orientation="horizontal" className="justify-between border-b border-muted pb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Registro</span>
                            <span className="text-[10px] font-semibold">{memberSince}</span>
                        </Field>
                        <Field orientation="horizontal" className="justify-between">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Verificación</span>
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/10 text-[9px] px-1.5 h-4" variant="outline">OK</Badge>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 flex items-center gap-3">
                <IconShieldCheck size={20} className="text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-800 leading-tight">Acceso maestro protegido con cifrado activo.</p>
            </div>
        </div>

        {/* Right Column: Form with Field Pattern (Compact) */}
        <div className="lg:col-span-8">
            <Card className="border shadow-none">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg">Información del Perfil</CardTitle>
                    <CardDescription className="text-xs">Campos de identidad y localización oficial.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                    <form>
                        <FieldGroup className="gap-4">
                            <FieldSet className="gap-3">
                                <FieldLegend className="text-[10px] mb-1">Identidad</FieldLegend>
                                <FieldGroup className="grid md:grid-cols-2 gap-4">
                                    <Field className="gap-1">
                                        <FieldLabel htmlFor="name" className="text-xs">Nombre Completo</FieldLabel>
                                        <Input
                                            id="name"
                                            className="h-9 text-sm"
                                            placeholder="Evil Rabbit"
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            required
                                        />
                                    </Field>
                                    <Field className="gap-1">
                                        <FieldLabel htmlFor="email" className="text-xs">Email</FieldLabel>
                                        <Input
                                            id="email"
                                            className="h-9 text-sm bg-muted/30 cursor-not-allowed"
                                            type="email"
                                            value={formData.email}
                                            readOnly
                                        />
                                    </Field>
                                </FieldGroup>
                            </FieldSet>

                            <FieldSeparator />

                            <FieldSet className="gap-3">
                                <FieldLegend className="text-[10px] mb-1">Localización</FieldLegend>
                                <FieldGroup className="grid md:grid-cols-2 gap-4">
                                    <Field className="gap-1">
                                        <FieldLabel htmlFor="country" className="text-xs">País</FieldLabel>
                                        <Select value={formData.country} onValueChange={(val) => setFormData({...formData, country: val})}>
                                            <SelectTrigger id="country" className="h-9 text-sm">
                                                <SelectValue placeholder="Seleccione país" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Venezuela">Venezuela</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field className="gap-1">
                                        <FieldLabel htmlFor="city" className="text-xs">Estado / Región</FieldLabel>
                                        <Select value={formData.city} onValueChange={(val) => setFormData({...formData, city: val})}>
                                            <SelectTrigger id="city" className="h-9 text-sm">
                                                <SelectValue placeholder="Seleccione estado" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {VENEZUELA_STATES.map((state) => (
                                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </FieldGroup>
                            </FieldSet>

                            <FieldSeparator />

                            <FieldSet className="gap-3">
                                <FieldLegend className="text-[10px] mb-1">Seguridad de Acceso</FieldLegend>
                                <FieldGroup className="gap-4">
                                    <Field orientation="horizontal" className="justify-between bg-muted/20 p-3 rounded-md">
                                        <div className="grid gap-0.5">
                                            <FieldLabel className="text-xs">Contraseña de acceso</FieldLabel>
                                            <FieldDescription className="text-[10px]">Actualice su clave periódicamente</FieldDescription>
                                        </div>
                                        <Button 
                                            type="button"
                                            variant={showPasswordFields ? "secondary" : "outline"}
                                            onClick={() => setShowPasswordFields(!showPasswordFields)}
                                            size="sm" 
                                            className="h-7 px-3 text-[10px] gap-1.5"
                                        >
                                            <IconLock size={12} /> {showPasswordFields ? "Cancelar" : "Modificar"}
                                        </Button>
                                    </Field>

                                    {showPasswordFields && (
                                        <div className="grid md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                                            <Field className="gap-1">
                                                <FieldLabel className="text-xs">Nueva Contraseña</FieldLabel>
                                                <Input 
                                                    type="password" 
                                                    className="h-9 text-sm"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                                    placeholder="••••••••"
                                                />
                                            </Field>
                                            <Field className="gap-1">
                                                <FieldLabel className="text-xs">Repetir Contraseña</FieldLabel>
                                                <Input 
                                                    type="password" 
                                                    className="h-9 text-sm"
                                                    value={formData.confirmPassword}
                                                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                                                    placeholder="••••••••"
                                                />
                                            </Field>
                                        </div>
                                    )}
                                </FieldGroup>
                            </FieldSet>
                        </FieldGroup>
                    </form>
                </CardContent>
                <CardFooter className="border-t bg-muted/5 p-4 flex justify-end">
                    <Button 
                        onClick={handleUpdate} 
                        disabled={submitting || uploading}
                        className="gap-2 h-8 px-4 text-xs"
                    >
                        {submitting ? <IconLoader2 className="animate-spin" size={14} /> : <IconDeviceFloppy size={14} />} 
                        {submitting ? "Actualizando..." : "Guardar cambios"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
