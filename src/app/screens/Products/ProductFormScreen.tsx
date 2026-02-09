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
  KeyboardAvoidingView,
  Platform,
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

import type {
  Product,
  ProductFilament,
  ProductAccessory,
} from "../../domain/models/Product";
import type { Filament } from "../../domain/models/Filament";
import type { Accessory } from "../../domain/models/Accessory";

import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import {
  SettingsRepository,
  AppSettings,
} from "../../domain/repositories/SettingsRepository";
import { AccessoryRepository } from "../../domain/repositories/AccessoryRepository";
import { uid } from "../../core/utils/uuid";

type R = RouteProp<ProductsStackParamList, "ProductForm">;
type Nav = NativeStackNavigationProp<ProductsStackParamList>;

// --- Funções Auxiliares ---
function toNumber(v: string): number {
  const cleaned = (v ?? "").replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function toMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function norm(s?: string) {
  return (s ?? "").trim();
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

// --- Tipos Locais ---
type PickerField = "material" | "color" | "brand" | "accessory";

export function ProductFormScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const tabBarHeight = useBottomTabBarHeight();

  const id = route.params?.id;
  const isEdit = useMemo(() => Boolean(id), [id]);

  const [saving, setSaving] = useState(false);

  // --- Estados do Formulário ---
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const [filaments, setFilaments] = useState<ProductFilament[]>([]);
  const [accessories, setAccessories] = useState<ProductAccessory[]>([]);

  // --- Dados Externos ---
  const [allSpools, setAllSpools] = useState<Filament[]>([]);
  const [allAccessories, setAllAccessories] = useState<Accessory[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // --- Controles de UI ---
  const [recipeExpanded, setRecipeExpanded] = useState(true);
  const [accExpanded, setAccExpanded] = useState(false);

  // Campos temporários
  const [fMaterial, setFMaterial] = useState("PLA");
  const [fColor, setFColor] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fGrams, setFGrams] = useState("");
  const [fPlateMin, setFPlateMin] = useState("");

  const [accSelected, setAccSelected] = useState<Accessory | null>(null);
  const [accQty, setAccQty] = useState("1");

  // Modal Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField>("material");
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerOptions, setPickerOptions] = useState<any[]>([]);

  // 1. Carregar Dados
  useEffect(() => {
    (async () => {
      try {
        const [spools, accs, sett] = await Promise.all([
          FilamentRepository.list(),
          AccessoryRepository.list(),
          SettingsRepository.get(),
        ]);
        setAllSpools(spools);
        setAllAccessories(accs);
        setSettings(sett);
      } catch (e) {
        console.error("Erro ao carregar dados:", e);
      }
    })();
  }, []);

  // 2. Carregar Produto
  useEffect(() => {
    (async () => {
      if (!id) return;
      const p = await ProductRepository.getById(id);
      if (!p) return;

      setName(p.name ?? "");
      setDescription((p as any).description ?? "");
      setPrice(p.priceBRL ? String(p.priceBRL) : "");
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

  // --- CALCULADORA ---
  const costAnalysis = useMemo(() => {
    if (!settings) return null;

    let totalMaterialCost = 0;
    let totalTimeHours = 0;

    for (const f of filaments) {
      const match = allSpools.find(
        (s) =>
          norm(s.material) === norm(f.material) &&
          norm(s.color) === norm(f.color) &&
          (!f.brand || norm(s.brand) === norm(f.brand)),
      );

      const spoolCost = match?.cost ?? 0;
      const spoolWeight = match?.weightInitialG ?? 1000;
      const costPerGram = spoolWeight > 0 ? spoolCost / spoolWeight : 0;

      totalMaterialCost += f.grams * costPerGram;
      totalTimeHours += f.plateMinutes / 60;
    }

    let totalAccessoryCost = 0;
    for (const a of accessories) {
      const match = allAccessories.find((item) => item.name === a.name);
      const unitCost = match?.cost ?? 0;
      totalAccessoryCost += unitCost * a.quantity;
    }

    const costEnergy =
      (settings.powerWatts / 1000) * totalTimeHours * settings.energyCostKwh;
    const costDepreciation =
      (settings.printerPrice / settings.lifespanHours) * totalTimeHours;
    const costFixed =
      (settings.monthlyFixedCost / settings.monthlyPrintHours) * totalTimeHours;

    const baseProd =
      totalMaterialCost +
      totalAccessoryCost +
      costEnergy +
      costDepreciation +
      costFixed;
    const costFailure = baseProd * (settings.failureRate / 100);
    const totalCost = baseProd + costFailure;

    const markupMultiplier = 1 + settings.defaultMarkup / 100;
    const suggestedRetail = totalCost * markupMultiplier;
    const suggestedWholesale = suggestedRetail / 2;

    const salesPrice = toNumber(price);
    const profit = salesPrice - totalCost;
    const margin = salesPrice > 0 ? (profit / salesPrice) * 100 : 0;

    return {
      totalMaterialCost,
      totalAccessoryCost,
      totalTimeHours,
      totalCost,
      suggestedRetail,
      suggestedWholesale,
      salesPrice,
      profit,
      margin,
    };
  }, [filaments, accessories, price, allSpools, allAccessories, settings]);

  // --- Lógica de Imagem ---
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
      const permFunc =
        source === "gallery"
          ? ImagePicker.requestMediaLibraryPermissionsAsync
          : ImagePicker.requestCameraPermissionsAsync;

      const perm = await permFunc();
      if (perm.status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert("Permissão necessária", "Permita o acesso para continuar.");
        return;
      }

      // CORREÇÃO: Verifica dinamicamente qual MediaType usar para evitar crash
      // Se 'MediaType' existir (SDK novo), usa. Se não, usa 'MediaTypeOptions' (SDK antigo/estável).
      const mediaTypes = (ImagePicker as any).MediaType
        ? (ImagePicker as any).MediaType.Images
        : (ImagePicker as any).MediaTypeOptions.Images;

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: mediaTypes,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      };

      const result =
        source === "gallery"
          ? await ImagePicker.launchImageLibraryAsync(options)
          : await ImagePicker.launchCameraAsync(options);

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      const finalUri = await persistOrFallback(uri);
      setPhotoUri(finalUri);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Erro na foto.");
    }
  }

  // --- UI Helpers e Pickers ---
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

  function openPicker(field: PickerField) {
    if (field === "material") {
      setPickerField("material");
      setPickerTitle("Material");
      setPickerOptions(materialOptions);
      setPickerOpen(true);
    } else if (field === "color") {
      setPickerField("color");
      setPickerTitle("Cor");
      setPickerOptions(colorOptions);
      setPickerOpen(true);
    } else if (field === "brand") {
      setPickerField("brand");
      setPickerTitle("Marca");
      setPickerOptions(brandOptions.length ? brandOptions : ["(Sem marca)"]);
      setPickerOpen(true);
    } else if (field === "accessory") {
      setPickerField("accessory");
      setPickerTitle("Selecionar Acessório");
      setPickerOptions(allAccessories);
      setPickerOpen(true);
    }
  }

  function applyPickerValue(v: any) {
    if (pickerField === "material") setFMaterial(v);
    if (pickerField === "color") setFColor(v);
    if (pickerField === "brand") setFBrand(v);
    if (pickerField === "accessory") setAccSelected(v);
    setPickerOpen(false);
  }

  function addFilament() {
    const grams = toNumber(fGrams);
    const plate = toNumber(fPlateMin);
    if (!norm(fMaterial) || !norm(fColor) || grams <= 0 || plate <= 0) {
      Alert.alert(
        "Inválido",
        "Preencha Material, Cor, Peso e Tempo (maiores que 0).",
      );
      return;
    }
    setFilaments((prev) => [
      ...prev,
      {
        material: norm(fMaterial),
        color: norm(fColor),
        brand: fBrand === "(Sem marca)" ? undefined : norm(fBrand) || undefined,
        grams,
        plateMinutes: plate,
      },
    ]);
    setFGrams("");
    setFPlateMin("");
  }

  function addAccessory() {
    if (!accSelected) {
      Alert.alert("Validação", "Selecione um item da lista.");
      return;
    }
    const q = Math.trunc(toNumber(accQty));
    const qty = q > 0 ? q : 1;
    setAccessories((prev) => [
      ...prev,
      { name: accSelected.name, quantity: qty },
    ]);
    setAccSelected(null);
    setAccQty("1");
  }

  function removeFilament(idx: number) {
    setFilaments((prev) => prev.filter((_, i) => i !== idx));
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
      const pPrice = toNumber(price);

      const base: Product = {
        id: id ?? uid(),
        name: name.trim(),
        description: description.trim() || undefined,
        priceBRL: Number.isFinite(pPrice) ? pPrice : 0,
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

      await ProductRepository.upsert(base);
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erro", "Falha ao salvar produto: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen contentStyle={{ padding: 0 }}>
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={[styles.h1, { color: colors.textPrimary }]}>
              {isEdit ? "Editar Produto" : "Novo Produto"}
            </Text>
            <Pressable
              onPress={() => navigation.navigate("CostParameters" as never)}
              style={{ padding: 8 }}
            >
              <MaterialIcons name="settings" size={24} color={colors.primary} />
            </Pressable>
          </View>

          <AppInput
            label="Nome"
            value={name}
            onChangeText={setName}
            placeholder="Ex: Chaveiro Capivara"
          />

          {/* FOTO */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.h2, { color: colors.textPrimary }]}>Foto</Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 12,
                alignItems: "center",
              }}
            >
              <View
                style={[
                  styles.photoBox,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.iconBg,
                  },
                ]}
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
                <AppButton title="Câmera" onPress={() => pickPhoto("camera")} />
                <AppButton
                  title="Galeria"
                  variant="ghost"
                  onPress={() => pickPhoto("gallery")}
                />
              </View>
            </View>
          </View>

          {/* CALCULADORA */}
          {costAnalysis && (
            <View
              style={[
                styles.calcCard,
                { backgroundColor: colors.iconBg, borderColor: colors.primary },
              ]}
            >
              <Text
                style={[styles.h2, { color: colors.primary, marginBottom: 12 }]}
              >
                Precificação e Custo
              </Text>

              <View style={styles.calcRow}>
                <Text style={{ color: colors.textSecondary }}>
                  Material ({filaments.length} itens)
                </Text>
                <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                  {toMoney(costAnalysis.totalMaterialCost)}
                </Text>
              </View>

              {costAnalysis.totalAccessoryCost > 0 && (
                <View style={styles.calcRow}>
                  <Text style={{ color: colors.textSecondary }}>
                    Acessórios ({accessories.length} itens)
                  </Text>
                  <Text
                    style={{ fontWeight: "bold", color: colors.textPrimary }}
                  >
                    {toMoney(costAnalysis.totalAccessoryCost)}
                  </Text>
                </View>
              )}

              <View style={styles.calcRow}>
                <Text style={{ color: colors.textSecondary }}>
                  Tempo Máquina ({costAnalysis.totalTimeHours.toFixed(1)}h)
                </Text>
                <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                  {toMoney(
                    costAnalysis.totalCost -
                      costAnalysis.totalMaterialCost -
                      costAnalysis.totalAccessoryCost,
                  )}
                </Text>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 8,
                }}
              />

              <View style={styles.calcRow}>
                <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
                  CUSTO TOTAL
                </Text>
                <Text style={{ fontWeight: "900", color: colors.error }}>
                  {toMoney(costAnalysis.totalCost)}
                </Text>
              </View>

              <View style={{ marginTop: 8, gap: 4 }}>
                <View style={styles.calcRow}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Sugestão Consumidor (Markup {settings?.defaultMarkup}%)
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: colors.textPrimary,
                    }}
                  >
                    {toMoney(costAnalysis.suggestedRetail)}
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Sugestão Lojista (50%)
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: colors.textPrimary,
                    }}
                  >
                    {toMoney(costAnalysis.suggestedWholesale)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 8,
                }}
              />

              <View style={styles.calcRow}>
                <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
                  SEU LUCRO REAL
                </Text>
                <Text
                  style={{
                    fontWeight: "900",
                    color:
                      costAnalysis.profit > 0 ? colors.success : colors.error,
                  }}
                >
                  {toMoney(costAnalysis.profit)} (
                  {costAnalysis.margin.toFixed(0)}%)
                </Text>
              </View>
            </View>
          )}

          <View style={{ width: "60%" }}>
            <AppInput
              label="Seu Preço de Venda (R$)"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="Ex: 35.00"
            />
          </View>

          <AppInput
            label="Descrição"
            value={description}
            onChangeText={setDescription}
            placeholder="Detalhes..."
          />

          {/* RECEITA */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setRecipeExpanded((v) => !v)}
              style={styles.sectionHeader}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>
                  Receita (Filamentos)
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {filaments.length} itens cadastrados
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
                      Material
                    </Text>
                    <Pressable
                      onPress={() => openPicker("material")}
                      style={[styles.dropdown, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.textPrimary }}>
                        {fMaterial}
                      </Text>
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
                      style={[styles.dropdown, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.textPrimary }}>
                        {fColor || "Selecione"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      Marca (Opcional)
                    </Text>
                    <Pressable
                      onPress={() => openPicker("brand")}
                      style={[styles.dropdown, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.textPrimary }}>
                        {fBrand || "(Sem marca)"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Peso (g)"
                      value={fGrams}
                      onChangeText={setFGrams}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Tempo (min)"
                      value={fPlateMin}
                      onChangeText={setFPlateMin}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <AppButton title="Adicionar" onPress={addFilament} />
                  </View>
                </View>

                {filaments.map((f, i) => (
                  <View
                    key={i}
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
                          fontWeight: "bold",
                          color: colors.textPrimary,
                        }}
                      >
                        {f.material} {f.color} {f.brand}
                      </Text>
                      <Text style={{ color: colors.textSecondary }}>
                        {f.grams}g • {f.plateMinutes}min
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeFilament(i)}
                      style={styles.iconBtn}
                    >
                      <MaterialIcons
                        name="delete"
                        size={20}
                        color={colors.textPrimary}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* ACESSÓRIOS */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setAccExpanded((v) => !v)}
              style={styles.sectionHeader}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>
                  Acessórios / Extras
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {accessories.length} itens cadastrados
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
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      Item
                    </Text>
                    <Pressable
                      onPress={() => openPicker("accessory")}
                      style={[styles.dropdown, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.textPrimary }}>
                        {accSelected ? accSelected.name : "Selecionar..."}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ width: 80 }}>
                    <AppInput
                      label="Qtd"
                      value={accQty}
                      onChangeText={setAccQty}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {allAccessories.length === 0 && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.error,
                      marginBottom: 8,
                    }}
                  >
                    Nenhum acessório cadastrado. Vá em Configurações para
                    cadastrar.
                  </Text>
                )}

                <AppButton title="Adicionar Extra" onPress={addAccessory} />

                {accessories.map((a, i) => (
                  <View
                    key={i}
                    style={[
                      styles.rowCard,
                      {
                        backgroundColor: colors.iconBg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontWeight: "bold",
                        color: colors.textPrimary,
                      }}
                    >
                      {a.name} (x{a.quantity})
                    </Text>
                    <Pressable
                      onPress={() => removeAccessory(i)}
                      style={styles.iconBtn}
                    >
                      <MaterialIcons
                        name="delete"
                        size={20}
                        color={colors.textPrimary}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <AppButton
            title={saving ? "Salvando..." : "Salvar Produto"}
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
          style={[styles.modalBackdrop, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={() => setPickerOpen(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {pickerTitle}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {pickerOptions.map((o, idx) => {
                const label = typeof o === "string" ? o : o.name;
                const val = o;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => applyPickerValue(val)}
                    style={{
                      padding: 12,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: "bold" }}
                    >
                      {label}
                    </Text>
                    {typeof o !== "string" && (
                      <Text style={{ color: colors.textSecondary }}>
                        {toMoney(o.cost)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
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
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grid2: { flexDirection: "row", gap: 12 },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
    height: 50,
  },
  dropdownText: { fontSize: 15, fontWeight: "800" },
  label: { fontSize: 12, fontWeight: "bold", marginBottom: 4 },

  photoBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  calcCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderStyle: "dashed",
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconBtn: { padding: 4 },

  modalBackdrop: { flex: 1, justifyContent: "center", padding: 20 },
  modalCard: { borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
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
