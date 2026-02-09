import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  KeyboardAvoidingView, // Adicionado para melhor UX
  Platform, // Adicionado
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

import type { ProductsStackParamList } from "../../navigation/types";
import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";

import type { Product, ProductFilament } from "../../domain/models/Product";
import type { Filament } from "../../domain/models/Filament";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { uid } from "../../core/utils/uuid";

type R = RouteProp<ProductsStackParamList, "ProductForm">;
type Nav = NativeStackNavigationProp<ProductsStackParamList>;

function toNumber(v: string): number {
  const cleaned = (v ?? "").replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}
function norm(s?: string) {
  return (s ?? "").trim();
}
function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

type PickerField = "material" | "color" | "brand";

type ProductAccessory = {
  name: string;
  quantity: number;
};

export function ProductFormScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const tabBarHeight = useBottomTabBarHeight();
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const id = route.params?.id;
  const isEdit = useMemo(() => Boolean(id), [id]);

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(""); // ✅ Novo estado para Preço

  const [filaments, setFilaments] = useState<ProductFilament[]>([]);
  const [accessories, setAccessories] = useState<ProductAccessory[]>([]);

  // Seções expandíveis
  const [recipeExpanded, setRecipeExpanded] = useState(false);
  const [accExpanded, setAccExpanded] = useState(false);

  // Estoque para dropdowns
  const [allSpools, setAllSpools] = useState<Filament[]>([]);

  // Campos do item de receita
  const [fMaterial, setFMaterial] = useState("PLA");
  const [fColor, setFColor] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fGrams, setFGrams] = useState("");
  const [fPlateMin, setFPlateMin] = useState("");

  // Acessórios
  const [accName, setAccName] = useState("");
  const [accQty, setAccQty] = useState("1");

  // Modal picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField>("material");
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerOptions, setPickerOptions] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const spools = await FilamentRepository.list();
      setAllSpools(spools);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!id) return;

      const p = await ProductRepository.getById(id);
      if (!p) return;

      setName(p.name ?? "");
      setDescription((p as any).description ?? "");
      setPrice(p.priceBRL ? String(p.priceBRL) : ""); // ✅ Carrega preço
      setPhotoUri((p as any).photoUri);

      const loadedFilaments = ((p as any).filaments ?? []).map((x: any) => ({
        ...x,
        plateMinutes: x.plateMinutes ?? 0,
      })) as ProductFilament[];
      setFilaments(loadedFilaments);

      const loadedAcc = ((p as any).accessories ?? []) as ProductAccessory[];
      setAccessories(loadedAcc);
    })();
  }, [id]);

  // opções derivadas
  const materialOptions = useMemo(
    () => uniq(allSpools.map((s) => norm(s.material))),
    [allSpools],
  );

  const colorOptions = useMemo(() => {
    const m = norm(fMaterial);
    if (!m) return [];
    return uniq(
      allSpools.filter((s) => norm(s.material) === m).map((s) => norm(s.color)),
    );
  }, [allSpools, fMaterial]);

  const brandOptions = useMemo(() => {
    const m = norm(fMaterial);
    const c = norm(fColor);
    if (!m || !c) return [];

    const brands = uniq(
      allSpools
        .filter((s) => norm(s.material) === m && norm(s.color) === c)
        .map((s) => norm((s as any).brand)),
    );

    const hasNoBrand = allSpools.some(
      (s) =>
        norm(s.material) === m &&
        norm(s.color) === c &&
        !norm((s as any).brand),
    );

    const finalList = [...brands];
    if (hasNoBrand) finalList.unshift("(Sem marca)");
    return finalList;
  }, [allSpools, fMaterial, fColor]);

  useEffect(() => {
    setFColor("");
    setFBrand("");
  }, [fMaterial]);

  useEffect(() => {
    setFBrand("");
  }, [fColor]);

  const totalPlateMinutes = useMemo(() => {
    return (filaments ?? []).reduce(
      (sum, f: any) => sum + (f.plateMinutes ?? 0),
      0,
    );
  }, [filaments]);

  function openPicker(field: PickerField) {
    if (field === "material") {
      setPickerField("material");
      setPickerTitle("Selecionar material");
      setPickerOptions(materialOptions);
      setPickerOpen(true);
      return;
    }

    if (field === "color") {
      if (!norm(fMaterial)) {
        Alert.alert("Selecione primeiro", "Escolha o material antes da cor.");
        return;
      }
      setPickerField("color");
      setPickerTitle("Selecionar cor");
      setPickerOptions(colorOptions);
      setPickerOpen(true);
      return;
    }

    if (field === "brand") {
      if (!norm(fMaterial) || !norm(fColor)) {
        Alert.alert(
          "Selecione primeiro",
          "Escolha material e cor antes da marca.",
        );
        return;
      }
      setPickerField("brand");
      setPickerTitle("Selecionar marca (opcional)");
      setPickerOptions(brandOptions.length ? brandOptions : ["(Sem marca)"]);
      setPickerOpen(true);
      return;
    }
  }

  function applyPickerValue(v: string) {
    if (pickerField === "material") setFMaterial(v);
    if (pickerField === "color") setFColor(v);
    if (pickerField === "brand") setFBrand(v);
    setPickerOpen(false);
  }

  const canAdd = useMemo(() => {
    const grams = toNumber(fGrams);
    const plate = toNumber(fPlateMin);
    return (
      norm(fMaterial).length > 0 &&
      norm(fColor).length > 0 &&
      Number.isFinite(grams) &&
      grams > 0 &&
      Number.isFinite(plate) &&
      plate > 0
    );
  }, [fMaterial, fColor, fGrams, fPlateMin]);

  function addFilament() {
    if (!canAdd) {
      Alert.alert(
        "Validação",
        "Informe material, cor, g/un e Plate (min). Plate deve ser maior que 0.",
      );
      return;
    }

    const grams = toNumber(fGrams);
    const plate = toNumber(fPlateMin);

    const item: ProductFilament = {
      material: norm(fMaterial),
      color: norm(fColor),
      brand: fBrand === "(Sem marca)" ? undefined : norm(fBrand) || undefined,
      grams,
      plateMinutes: plate,
    };

    setFilaments((prev) => [...prev, item]);

    setFColor("");
    setFBrand("");
    setFGrams("");
    setFPlateMin("");
  }

  function removeFilament(idx: number) {
    setFilaments((prev) => prev.filter((_, i) => i !== idx));
  }

  function addAccessory() {
    const n = norm(accName);
    const q = Math.trunc(toNumber(accQty));
    const qty = Number.isFinite(q) && q > 0 ? q : 1;

    if (!n) {
      Alert.alert("Validação", "Informe o nome do acessório.");
      return;
    }

    setAccessories((prev) => [...prev, { name: n, quantity: qty }]);
    setAccName("");
    setAccQty("1");
  }

  function removeAccessory(idx: number) {
    setAccessories((prev) => prev.filter((_, i) => i !== idx));
  }

  function validate() {
    if (!name.trim()) return "Informe o nome do produto.";
    return null;
  }

  async function onSave() {
    if (saving) return;

    const err = validate();
    if (err) {
      Alert.alert("Validação", err);
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const pPrice = toNumber(price); // ✅ Converte preço

      const base: any = {
        id: id ?? uid(),
        name: name.trim(),
        description: description.trim() || undefined,
        priceBRL: Number.isFinite(pPrice) ? pPrice : 0, // ✅ Salva preço
        filaments: (filaments ?? []).map((f: any) => ({
          ...f,
          plateMinutes: f.plateMinutes ?? 0,
        })),
        accessories: accessories ?? [],

        status: "ready",
        queuePosition: undefined,
        quantity: undefined,
        estimatedMinutes: undefined,
        startedAt: undefined,
        finishedAt: undefined,

        createdAt: now,
        updatedAt: now,
        photoUri,
      };

      if (id) {
        const old: any = await ProductRepository.getById(id);
        base.createdAt = old?.createdAt ?? now;

        if (old) {
          base.status = old.status;
          base.queuePosition = old.queuePosition;
          base.quantity = old.quantity;
          base.estimatedMinutes = old.estimatedMinutes;
          base.startedAt = old.startedAt;
          base.finishedAt = old.finishedAt;
        }
      }

      await ProductRepository.upsert(base as Product);
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erro ao salvar", e?.message ?? "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  // ... (Funções de Foto permanecem iguais: getAppDir, persistOrFallback, pickPhoto)
  function getAppDir(): string | null {
    const doc = (FileSystem as any).documentDirectory ?? null;
    const cache = (FileSystem as any).cacheDirectory ?? null;
    return doc ?? cache ?? null;
  }

  async function persistOrFallback(uri: string): Promise<string> {
    const appDir = getAppDir();
    if (!appDir) return uri;
    try {
      const ext = uri.split(".").pop() || "jpg";
      const filename = `product_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
      const dest = `${appDir}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch (e) {
      return uri;
    }
  }

  async function pickPhoto(source: "camera" | "gallery") {
    try {
      if (source === "gallery") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== ImagePicker.PermissionStatus.GRANTED) {
          Alert.alert("Permissão necessária", "Permita acesso à galeria.");
          return;
        }
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== ImagePicker.PermissionStatus.GRANTED) {
          Alert.alert("Permissão necessária", "Permita acesso à câmera.");
          return;
        }
      }
      const result =
        source === "gallery"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              allowsEditing: true,
              aspect: [1, 1],
            })
          : await ImagePicker.launchCameraAsync({
              quality: 0.85,
              allowsEditing: true,
              aspect: [1, 1],
            });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      const finalUri = await persistOrFallback(uri);
      return finalUri;
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Erro na foto.");
    }
  }

  return (
    <Screen contentStyle={{ padding: 0 }}>
      {/* Adicionado KeyboardAvoidingView para evitar que o teclado cubra os campos */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: tabBarHeight + 28,
            gap: 14,
          }}
        >
          <Text style={[styles.h1, { color: colors.textPrimary }]}>
            {isEdit ? "Editar Produto" : "Novo Produto"}
          </Text>

          <AppInput
            label="Nome"
            value={name}
            onChangeText={setName}
            placeholder="Ex: Chaveiro Capivara"
          />

          {/* ✅ NOVO CAMPO DE PREÇO */}
          <View style={{ width: "50%" }}>
            <AppInput
              label="Preço de Venda (R$)"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="Ex: 35.00"
            />
          </View>

          <AppInput
            label="Descrição (opcional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Detalhes, tamanho, acabamento..."
          />

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.h2, { color: colors.textPrimary }]}>
              Foto do produto
            </Text>

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.iconBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <MaterialIcons
                    name="image"
                    size={26}
                    color={colors.textSecondary}
                  />
                )}
              </View>

              <View style={{ flex: 1, gap: 8 }}>
                <AppButton
                  title="Tirar foto"
                  onPress={async () => {
                    const uri = await pickPhoto("camera");
                    if (uri) setPhotoUri(uri);
                  }}
                />

                <AppButton
                  title="Escolher da galeria"
                  onPress={async () => {
                    const uri = await pickPhoto("gallery");
                    if (uri) setPhotoUri(uri);
                  }}
                />

                {photoUri ? (
                  <AppButton
                    title="Remover foto"
                    variant="ghost"
                    onPress={() => setPhotoUri(undefined)}
                  />
                ) : null}
              </View>
            </View>
          </View>

          {/* ===== Receita (expandível) ===== */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setRecipeExpanded((v) => !v)}
              style={styles.sectionHeader}
              hitSlop={10}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>
                  Receita por filamento (por unidade)
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: "800",
                    marginTop: 4,
                  }}
                >
                  {filaments.length} item(ns) • Total Plate: {totalPlateMinutes}{" "}
                  min
                </Text>
              </View>
              <MaterialIcons
                name={recipeExpanded ? "expand-less" : "expand-more"}
                size={26}
                color={colors.textPrimary}
              />
            </Pressable>

            {recipeExpanded ? (
              <View style={{ gap: 12, marginTop: 12 }}>
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      Tipo de filamento
                    </Text>
                    <Pressable
                      onPress={() => openPicker("material")}
                      style={[
                        styles.dropdown,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.iconBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {norm(fMaterial) ? fMaterial : "Selecionar"}
                      </Text>
                      <MaterialIcons
                        name="expand-more"
                        size={20}
                        color={colors.textPrimary}
                      />
                    </Pressable>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      Cor
                    </Text>
                    <Pressable
                      onPress={() => openPicker("color")}
                      style={[
                        styles.dropdown,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.iconBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {norm(fColor) ? fColor : "Selecionar"}
                      </Text>
                      <MaterialIcons
                        name="expand-more"
                        size={20}
                        color={colors.textPrimary}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      Marca (opcional)
                    </Text>
                    <Pressable
                      onPress={() => openPicker("brand")}
                      style={[
                        styles.dropdown,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.iconBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {norm(fBrand) ? fBrand : "(Sem marca)"}
                      </Text>
                      <MaterialIcons
                        name="expand-more"
                        size={20}
                        color={colors.textPrimary}
                      />
                    </Pressable>
                  </View>

                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="g por unidade"
                      value={fGrams}
                      onChangeText={setFGrams}
                      keyboardType="numeric"
                      placeholder="Ex: 45"
                    />
                  </View>
                </View>

                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Plate (min)"
                      value={fPlateMin}
                      onChangeText={setFPlateMin}
                      keyboardType="numeric"
                      placeholder="Ex: 90"
                    />
                  </View>

                  <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <AppButton title="Adicionar item" onPress={addFilament} />
                  </View>
                </View>

                {filaments.length === 0 ? (
                  <Text
                    style={{
                      marginTop: 4,
                      color: colors.textSecondary,
                      fontWeight: "800",
                    }}
                  >
                    Plate (min) é obrigatório e deve ser maior que 0.
                  </Text>
                ) : (
                  <View style={{ gap: 10, marginTop: 8 }}>
                    {filaments.map((r: any, idx) => {
                      const label = r.brand
                        ? `${r.material} - ${r.color} - ${r.brand}`
                        : `${r.material} - ${r.color}`;

                      return (
                        <View
                          key={`${label}-${idx}`}
                          style={[
                            styles.rowCard,
                            {
                              backgroundColor: colors.iconBg,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: colors.textPrimary,
                                fontWeight: "900",
                              }}
                              numberOfLines={1}
                            >
                              {label}
                            </Text>
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontWeight: "800",
                                marginTop: 4,
                              }}
                            >
                              {r.grams}g/un • Plate: {r.plateMinutes} min
                            </Text>
                          </View>

                          <Pressable
                            onPress={() => removeFilament(idx)}
                            style={[
                              styles.iconBtn,
                              {
                                borderColor: colors.border,
                                backgroundColor: colors.surface,
                              },
                            ]}
                            hitSlop={10}
                          >
                            <MaterialIcons
                              name="delete"
                              size={18}
                              color={colors.textPrimary}
                            />
                          </Pressable>
                        </View>
                      );
                    })}

                    <View
                      style={[
                        styles.totalBox,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{ color: colors.textPrimary, fontWeight: "900" }}
                      >
                        Tempo total (Plate)
                      </Text>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: "900",
                          fontSize: 16,
                        }}
                      >
                        {totalPlateMinutes} min
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : null}
          </View>

          {/* ===== Acessórios (expandível) ===== */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setAccExpanded((v) => !v)}
              style={styles.sectionHeader}
              hitSlop={10}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>
                  Acessórios
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: "800",
                    marginTop: 4,
                  }}
                >
                  {accessories.length} item(ns)
                </Text>
              </View>
              <MaterialIcons
                name={accExpanded ? "expand-less" : "expand-more"}
                size={26}
                color={colors.textPrimary}
              />
            </Pressable>

            {accExpanded ? (
              <View style={{ gap: 12, marginTop: 12 }}>
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Acessório"
                      value={accName}
                      onChangeText={setAccName}
                      placeholder="Ex: Corrente de chaveiro"
                    />
                  </View>
                  <View style={{ width: 120 }}>
                    <AppInput
                      label="Qtd"
                      value={accQty}
                      onChangeText={setAccQty}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </View>
                </View>

                <AppButton title="Adicionar acessório" onPress={addAccessory} />

                {accessories.length ? (
                  <View style={{ gap: 10 }}>
                    {accessories.map((a, idx) => (
                      <View
                        key={`${a.name}-${idx}`}
                        style={[
                          styles.rowCard,
                          {
                            backgroundColor: colors.iconBg,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontWeight: "900",
                            }}
                            numberOfLines={1}
                          >
                            {a.name}
                          </Text>
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontWeight: "800",
                              marginTop: 4,
                            }}
                          >
                            Quantidade: {a.quantity}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => removeAccessory(idx)}
                          style={[
                            styles.iconBtn,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                            },
                          ]}
                          hitSlop={10}
                        >
                          <MaterialIcons
                            name="delete"
                            size={18}
                            color={colors.textPrimary}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text
                    style={{ color: colors.textSecondary, fontWeight: "800" }}
                  >
                    Ex.: corrente de chaveiro, argola, ímã, fita dupla-face…
                  </Text>
                )}
              </View>
            ) : null}
          </View>

          <AppButton
            title={saving ? "Salvando..." : "Salvar"}
            onPress={onSave}
            disabled={saving as any}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Picker */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={[
            styles.modalBackdrop,
            { backgroundColor: "rgba(0,0,0,0.45)" },
          ]}
          onPress={() => setPickerOpen(false)}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {pickerTitle}
            </Text>

            {pickerOptions.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontWeight: "800" }}>
                Nenhuma opção disponível. Cadastre filamentos antes.
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {pickerOptions.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[
                      styles.modalItem,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.iconBg,
                      },
                    ]}
                    onPress={() => applyPickerValue(opt)}
                  >
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: "800" }}
                    >
                      {opt}
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={18}
                      color={colors.textPrimary}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: "900" },
  h2: { fontSize: 15, fontWeight: "900" },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  grid2: { flexDirection: "row", gap: 12 },

  label: { fontSize: 13, fontWeight: "800", marginBottom: 6 },

  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: { fontSize: 15, fontWeight: "800" },

  rowCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  totalBox: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", marginBottom: 10 },
  modalItem: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
