import { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";

export const metadata: Metadata = {
  title: "Punto de venta (ant design) | Syncro",
  description: "Terminal de venta — variante de diseño ant design para comparación",
};

// Variante de estilo visual Ant Design del POS. Ruta separada de /pos —
// no reemplaza la implementación original, solo cambia el lenguaje visual.
const antdTheme = {
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 6,
    fontFamily:
      "'Segoe UI', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    fontSize: 13,
  },
  components: {
    Button: {
      controlHeight: 32,
      borderRadius: 6,
    },
    Card: {
      borderRadiusLG: 8,
    },
  },
};

export default function POSAntdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <main className="h-screen w-full flex flex-col">
        <AntdRegistry>
          <ConfigProvider theme={antdTheme} locale={esES}>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </main>
    </div>
  );
}
