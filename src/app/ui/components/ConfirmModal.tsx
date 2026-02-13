import React from "react";
import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { AppButton } from "./AppButton";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary"; // Para decidir se o botão é vermelho ou roxo
};

export function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary",
}: Props) {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: isDark ? "#000" : "#000",
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <AppButton
                title={cancelText}
                onPress={onCancel}
                variant="ghost"
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton
                title={confirmText}
                onPress={onConfirm}
                variant={variant}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.5)", // Fundo escurecido
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    // Sombra para dar destaque
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
});
