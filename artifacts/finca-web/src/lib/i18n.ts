import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  es: {
    translation: {
      "app.name": "Finca",
      "auth.login": "Iniciar Sesión",
      "auth.register": "Crear Cuenta",
      "auth.email": "Correo electrónico",
      "auth.password": "Contraseña",
      "auth.name": "Nombre completo",
      "auth.farmName": "Nombre de la finca",
      "auth.noAccount": "¿No tienes cuenta? Regístrate",
      "auth.hasAccount": "¿Ya tienes cuenta? Inicia sesión",
      "nav.dashboard": "Panel Principal",
      "nav.animals": "Animales",
      "nav.inventory": "Inventario",
      "nav.land": "Tierra",
      "nav.settings": "Ajustes",
      "dashboard.welcome": "Bienvenido a",
      "dashboard.totalAnimals": "Total Animales",
      "dashboard.lowStock": "Bajo Stock",
      "dashboard.upcomingTasks": "Próximas Tareas",
      "dashboard.recentActivity": "Actividad Reciente",
      "dashboard.animalsBySpecies": "Animales por Especie",
      "animals.search": "Buscar animales...",
      "animals.add": "Añadir Animal",
      "animals.species": "Especie",
      "animals.status": "Estado",
      "animals.weight": "Peso Actual",
      "inventory.search": "Buscar inventario...",
      "inventory.add": "Añadir Item",
      "inventory.category": "Categoría",
      "inventory.quantity": "Cantidad",
      "common.save": "Guardar",
      "common.cancel": "Cancelar",
      "common.edit": "Editar",
      "common.delete": "Eliminar",
      "land.comingSoon": "El módulo de Tierra llegará pronto.",
      "settings.farmDetails": "Detalles de la Finca",
      "settings.team": "Equipo",
      "settings.account": "Cuenta",
      "settings.dangerZone": "Zona de Peligro",
      "settings.deleteFarm": "Eliminar Finca"
    }
  },
  en: {
    translation: {
      "app.name": "Finca",
      "auth.login": "Log In",
      "auth.register": "Create Account",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.name": "Full Name",
      "auth.farmName": "Farm Name",
      "auth.noAccount": "Don't have an account? Sign up",
      "auth.hasAccount": "Already have an account? Log in",
      "nav.dashboard": "Dashboard",
      "nav.animals": "Animals",
      "nav.inventory": "Inventory",
      "nav.land": "Land",
      "nav.settings": "Settings",
      "dashboard.welcome": "Welcome to",
      "dashboard.totalAnimals": "Total Animals",
      "dashboard.lowStock": "Low Stock",
      "dashboard.upcomingTasks": "Upcoming Tasks",
      "dashboard.recentActivity": "Recent Activity",
      "dashboard.animalsBySpecies": "Animals by Species",
      "animals.search": "Search animals...",
      "animals.add": "Add Animal",
      "animals.species": "Species",
      "animals.status": "Status",
      "animals.weight": "Current Weight",
      "inventory.search": "Search inventory...",
      "inventory.add": "Add Item",
      "inventory.category": "Category",
      "inventory.quantity": "Quantity",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.edit": "Edit",
      "common.delete": "Delete",
      "land.comingSoon": "The Land module is coming soon.",
      "settings.farmDetails": "Farm Details",
      "settings.team": "Team",
      "settings.account": "Account",
      "settings.dangerZone": "Danger Zone",
      "settings.deleteFarm": "Delete Farm"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "es", // Default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
