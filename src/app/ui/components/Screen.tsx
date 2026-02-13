import React from "react";
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle; // estilo do container interno
};

export function Screen({ children, style, contentStyle }: Props) {
  const { colors } = useTheme();
  const isWeb = Platform.OS === "web";

  return (
    <View
      style={[
        styles.mainWrapper,
        { backgroundColor: colors.background }, // Garante fundo na tela toda
      ]}
    >
      <SafeAreaView
        style={[
          styles.safe,
          { backgroundColor: colors.background },
          // No PC, limita largura a 800px e centraliza. No celular, usa 100%.
          isWeb && {
            maxWidth: 800,
            width: "100%",
            alignSelf: "center",
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 20,
          },
          style,
        ]}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: colors.background },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, width: "100%" }, // Wrapper para preencher o fundo do navegador
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
});
