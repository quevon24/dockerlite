import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/ui/Toast";
import { SettingsProvider } from "./lib/SettingsContext";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ContainerDetailPage from "./pages/ContainerDetailPage";
import ImagesPage from "./pages/ImagesPage";
import VolumesPage from "./pages/VolumesPage";
import NetworksPage from "./pages/NetworksPage";
import SystemPage from "./pages/SystemPage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  return (
    <ErrorBoundary fallbackTitle="DockerLite encountered an error">
      <SettingsProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="containers/:id" element={<ContainerDetailPage />} />
                <Route path="images" element={<ImagesPage />} />
                <Route path="volumes" element={<VolumesPage />} />
                <Route path="networks" element={<NetworksPage />} />
                <Route path="system" element={<SystemPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
