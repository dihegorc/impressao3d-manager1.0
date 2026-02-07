import React from "react";
import { ThemeProvider } from "./src/app/ui/theme/ThemeContext";
import { ThemedNavigationContainer } from "./src/app/navigation/ThemedNavigationContainer";
import { AppNavigator } from "./src/app/navigation/AppNavigator";

export default function App() {
  return (
    <ThemeProvider>
      <ThemedNavigationContainer>
        <AppNavigator />
      </ThemedNavigationContainer>
    </ThemeProvider>
  );
}
