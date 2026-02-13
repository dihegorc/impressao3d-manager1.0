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
import * as DocumentPicker from "expo-document-picker";

import type { ProductsStackParamList } from "../../navigation/types";
import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";

import type {
  Product,
  PrintPlate,
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
import { ConfirmModal } from "../../ui/components/ConfirmModal";

type R = RouteProp<ProductsStackParamList, "ProductForm">;
type Nav = NativeStackNavigationProp<ProductsStackParamList>;

// --- Funções Auxiliares ---
function toNumber(v: string): number {
  const cleaned = (v ?? "").replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
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

// Tipo para controlar o Picker
type PickerState = {
  visible: boolean;
  field: "material" | "color" | "brand" | "accessory";
  targetPlateId?: string;
  title: string;
  options: any[];
};

export function ProductFormScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const tabBarHeight = useBottomTabBarHeight();

  const id = route.params?.id;
  const isEdit = useMemo(() => Boolean(id), [id]);

  const [saving, setSaving] = useState(false);

  // --- Estados do Produto ---
  const [name, setName] = useState("");
  const [productYield, setProductYield] = useState("1"); // Quantidade produzida pelo lote (Yield Global)
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const [plates, setPlates] = useState<PrintPlate[]>([]);
  const [platePreviews, setPlatePreviews] = useState<Record<string, string>>(
    {},
  );
  const [accessories, setAccessories] = useState<ProductAccessory[]>([]);
  const [plateToDelete, setPlateToDelete] = useState<number | null>(null);

  // --- Dados Externos ---
  const [allSpools, setAllSpools] = useState<Filament[]>([]);
  const [allAccessories, setAllAccessories] = useState<Accessory[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // --- UI State ---
  const [accExpanded, setAccExpanded] = useState(false);
  const [picker, setPicker] = useState<PickerState>({
    visible: false,
    field: "material",
    title: "",
    options: [],
  });

  // Inputs temporários
  const [accSelected, setAccSelected] = useState<Accessory | null>(null);
  const [accQty, setAccQty] = useState("1");

  const [filModalVisible, setFilModalVisible] = useState(false);
  const [targetPlateIndex, setTargetPlateIndex] = useState<number | null>(null);
  const [fMaterial, setFMaterial] = useState("PLA");
  const [fColor, setFColor] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fGrams, setFGrams] = useState("");

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
        console.error(e);
      }
    })();
  }, []);

  // 2. Carregar Produto
  useEffect(() => {
    (async () => {
      if (!id) {
        setPlates([
          {
            id: uid(),
            name: "Mesa 1",
            estimatedMinutes: 0,
            unitsOnPlate: 1, // Interno, será sobrescrito pelo global ao salvar
            filaments: [],
          },
        ]);
        return;
      }
      const p: any = await ProductRepository.getById(id);
      if (!p) return;

      setName(p.name ?? "");
      setDescription(p.description ?? "");
      setPrice(p.priceBRL ? String(p.priceBRL) : "");
      setPhotoUri(p.photoUri);
      setAccessories(p.accessories ?? []);

      // Recupera o Yield Global (Assume que todas as plates tem o mesmo valor salvo)
      const savedYield = p.plates?.[0]?.unitsOnPlate ?? 1;
      setProductYield(String(savedYield));

      if (p.plates && p.plates.length > 0) {
        setPlates(p.plates);
      } else if (p.filaments && p.filaments.length > 0) {
        setPlates([
          {
            id: uid(),
            name: "Mesa Principal",
            estimatedMinutes: p.estimatedMinutes ?? 0,
            unitsOnPlate: 1,
            filaments: p.filaments,
          },
        ]);
      } else {
        setPlates([
          {
            id: uid(),
            name: "Mesa 1",
            estimatedMinutes: 0,
            unitsOnPlate: 1,
            filaments: [],
          },
        ]);
      }
    })();
  }, [id]);

  // --- CALCULADORA (BATCH LOGIC) ---
  const costAnalysis = useMemo(() => {
    if (!settings) return null;

    const globalYield = Math.max(1, toNumber(productYield));

    // Acumuladores de CUSTO TOTAL DO LOTE
    let batchMaterial = 0;
    let batchEnergy = 0;
    let batchFixed = 0;
    let batchDepreciation = 0;
    let batchFailures = 0;

    let totalTimeHours = 0;

    // 1. Somar Custos das Plates (Lote Completo)
    for (const plate of plates) {
      const hours = plate.estimatedMinutes / 60;
      totalTimeHours += hours;

      // A. Material
      let plateFilamentCost = 0;
      for (const f of plate.filaments) {
        const match = allSpools.find(
          (s) =>
            norm(s.material) === norm(f.material) &&
            norm(s.color) === norm(f.color) &&
            (!f.brand || norm(s.brand) === norm(f.brand)),
        );
        const spoolWeight = match?.weightInitialG ?? 1000;
        const pricePerGram =
          (match?.cost ?? 0) / (spoolWeight > 0 ? spoolWeight : 1000);
        plateFilamentCost += f.grams * pricePerGram;
      }
      batchMaterial += plateFilamentCost;

      // B. Energia (Tempo * Potência)
      batchEnergy +=
        hours * (settings.powerWatts / 1000) * settings.energyCostKwh;

      // C. Depreciação (Tempo / Vida Útil)
      batchDepreciation +=
        (settings.printerPrice / settings.lifespanHours) * hours;

      // D. Custo Fixo (Tempo / Horas Mês)
      batchFixed +=
        (settings.monthlyFixedCost / settings.monthlyPrintHours) * hours;

      // E. Falhas (% sobre Material + Energia + Depreciação)
      const baseFail =
        plateFilamentCost +
        hours * (settings.powerWatts / 1000) * settings.energyCostKwh +
        (settings.printerPrice / settings.lifespanHours) * hours;
      batchFailures += baseFail * (settings.failureRate / 100);
    }

    // 2. Acessórios (Total para o Lote)
    let batchAccessories = 0;
    for (const a of accessories) {
      const match = allAccessories.find((item) => item.name === a.name);
      const itemCost = match?.cost ?? 0;
      // CORREÇÃO: Não multiplica pelo yield. A quantidade na lista É o total para o lote.
      batchAccessories += itemCost * a.quantity;
    }

    // 3. Custo Total do Lote
    const totalBatchCost =
      batchMaterial +
      batchEnergy +
      batchAccessories +
      batchFixed +
      batchDepreciation +
      batchFailures;

    // 4. Custo Unitário
    const unitCost = totalBatchCost / globalYield;

    // 5. Precificação (Baseada no Custo Unitário)
    const markupMultiplier = 1 + settings.defaultMarkup / 100;
    const suggestedRetail = unitCost * markupMultiplier;
    const suggestedWholesale = suggestedRetail / 2;

    const salesPrice = toNumber(price);
    const profit = salesPrice - unitCost;
    const margin = salesPrice > 0 ? (profit / salesPrice) * 100 : 0;

    return {
      batchMaterial,
      batchEnergy,
      batchFixed,
      batchDepreciation,
      batchFailures,
      batchAccessories,

      totalBatchCost,
      totalTimeHours,
      globalYield,

      unitCost,

      suggestedRetail,
      suggestedWholesale,
      profit,
      margin,
    };
  }, [
    plates,
    accessories,
    price,
    allSpools,
    allAccessories,
    settings,
    productYield,
  ]);

  const totalFilamentsCount = useMemo(() => {
    return plates.reduce((acc, p) => acc + p.filaments.length, 0);
  }, [plates]);

  const totalAccessoryCount = useMemo(() => {
    return accessories.reduce((acc, a) => acc + a.quantity, 0);
  }, [accessories]);

  // --- Helpers UI ---
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
    return uniq(
      allSpools
        .filter((s) => norm(s.material) === m && norm(s.color) === c)
        .map((s) => norm((s as any).brand)),
    );
  }, [allSpools, fMaterial, fColor]);

  function openPicker(field: any, title: string, options: any[]) {
    setPicker({ visible: true, field, title, options });
  }
  function applyPickerValue(v: any) {
    if (picker.field === "material") setFMaterial(v);
    if (picker.field === "color") setFColor(v);
    if (picker.field === "brand") setFBrand(v);
    if (picker.field === "accessory") setAccSelected(v);
    setPicker({ ...picker, visible: false });
  }

  // --- CRUD PLATES ---
  function updatePlateTime(index: number, type: "h" | "m", value: string) {
    const list = [...plates];
    const currentTotal = list[index].estimatedMinutes;
    const currentH = Math.floor(currentTotal / 60);
    const currentM = currentTotal % 60;

    let newH = currentH;
    let newM = currentM;
    const val = parseInt(value) || 0;

    if (type === "h") newH = val;
    if (type === "m") newM = Math.min(59, val);

    list[index] = { ...list[index], estimatedMinutes: newH * 60 + newM };
    setPlates(list);
  }

  function updatePlateName(index: number, value: string) {
    const list = [...plates];
    list[index] = { ...list[index], name: value };
    setPlates(list);
  }

  function addPlate() {
    setPlates([
      ...plates,
      {
        id: uid(),
        name: `Mesa ${plates.length + 1}`,
        estimatedMinutes: 0,
        unitsOnPlate: 1,
        filaments: [],
      },
    ]);
  }

  // Função auxiliar para ler arquivos tanto no Mobile quanto na Web
  async function readFileContent(uri: string): Promise<string> {
    if (Platform.OS === "web") {
      // Na Web, o URI é um blob, lemos via fetch
      const response = await fetch(uri);
      return await response.text();
    } else {
      // No Mobile (Android/iOS), usamos o FileSystem
      return await FileSystem.readAsStringAsync(uri);
    }
  }

  async function importGcodesBatch() {
    try {
      const allFilesType = "*/*"; // Na web é melhor deixar genérico para garantir que o navegador aceite

      const res: any = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: allFilesType,
      });

      if (res.canceled) return;

      // Normalização dos assets (Web vs Mobile)
      const assets = res.assets ? res.assets : [res];

      if (!assets || assets.length === 0) {
        return Alert.alert("Importar", "Nenhum arquivo selecionado.");
      }

      // Filtragem de extensão (flexível para evitar erros na web se o mime type vier estranho)
      const gcodeAssets = assets.filter((a: any) => {
        const name = a.name ? a.name.toLowerCase() : "";
        return name.endsWith(".gcode") || name.endsWith(".gco");
      });

      if (gcodeAssets.length === 0) {
        return Alert.alert(
          "Erro de Formato",
          "Selecione arquivos com extensão .gcode ou .gco.",
        );
      }

      setSaving(true); // Bloqueia UI enquanto processa (opcional, mas recomendado)

      const importedPlates: PrintPlate[] = [];
      const previewUpdates: Record<string, string> = {};

      // Verifica se devemos substituir a "Mesa 1" vazia inicial
      const shouldReplace =
        plates.length === 1 &&
        plates[0].estimatedMinutes === 0 &&
        (plates[0].filaments?.length ?? 0) === 0;

      const defaultSpool = allSpools?.[0];

      // Loop de processamento
      for (let i = 0; i < gcodeAssets.length; i++) {
        const a = gcodeAssets[i];
        const uri: string = a.uri;
        const name: string = a.name ?? `Mesa Importada ${i + 1}`;

        try {
          // --- AQUI ESTÁ A CORREÇÃO PRINCIPAL ---
          const content = await readFileContent(uri);
          // --------------------------------------

          const minutes = parseGcodeTimeMinutes(content);
          const grams = parseGcodeWeightGrams(content, 1.75, 1.24);
          const finfo = parseBambuFilamentInfo(content);
          const thumb = extractGcodeThumbnailDataUri(content); // Miniatura (se houver)

          const plateId = uid();

          // Tenta inferir material/cor do G-code ou usa o padrão do banco
          const material = finfo.material || defaultSpool?.material || "PLA";
          const brand = finfo.brand || defaultSpool?.brand || "";
          const color = finfo.colorHex || defaultSpool?.color || "";

          const filaments: ProductFilament[] = [];

          // Só adiciona filamento se detectou peso maior que 0
          if (grams > 0) {
            filaments.push({
              filamentId: defaultSpool?.id, // Pode ficar undefined se não bater
              material,
              color,
              brand,
              grams: Math.round(grams * 100) / 100, // Arredonda 2 casas
            } as any);
          }

          importedPlates.push({
            id: plateId,
            name: name.replace(/\.(gcode|gco)$/i, ""),
            estimatedMinutes: Math.round(minutes),
            unitsOnPlate: 1, // Padrão 1, será ajustado pelo Yield global ao salvar
            filaments,
          });

          if (thumb?.dataUri) {
            previewUpdates[plateId] = thumb.dataUri;
          }
        } catch (err) {
          console.error(`Erro ao ler arquivo ${name}:`, err);
          // Não para o loop, tenta o próximo arquivo
        }
      }

      setSaving(false);

      if (importedPlates.length === 0) {
        return Alert.alert(
          "Erro",
          "Não foi possível ler os dados dos arquivos G-code.",
        );
      }

      // Atualiza estados
      setPlatePreviews((prev) => ({ ...prev, ...previewUpdates }));

      if (shouldReplace) {
        setPlates(importedPlates);
      } else {
        setPlates((prev) => [...prev, ...importedPlates]);
      }

      Alert.alert("Sucesso", `${importedPlates.length} mesa(s) importada(s).`);
    } catch (e: any) {
      setSaving(false);
      console.error("Erro geral no import:", e);
      Alert.alert("Erro", e.message || "Falha na importação.");
    }
  }

  function removePlate(index: number) {
    setPlateToDelete(index); // Abre o ConfirmModal
  }

  function confirmRemovePlate() {
    if (plateToDelete !== null) {
      setPlates((prev) => prev.filter((_, i) => i !== plateToDelete));
      setPlateToDelete(null);
    }
  }

  function openAddFilament(plateIndex: number) {
    setTargetPlateIndex(plateIndex);
    setFMaterial("");
    setFColor("");
    setFBrand("");
    setFGrams("");
    setFilModalVisible(true);
  }
  function confirmAddFilament() {
    if (targetPlateIndex === null) return;
    const grams = toNumber(fGrams);
    if (!norm(fMaterial) || !norm(fColor) || grams <= 0)
      return Alert.alert("Preencha os dados");
    const list = [...plates];
    list[targetPlateIndex].filaments.push({
      material: norm(fMaterial),
      color: norm(fColor),
      brand: fBrand,
      grams,
    });
    setPlates(list);
    setFilModalVisible(false);
  }
  function removeFilamentFromPlate(pIdx: number, fIdx: number) {
    const list = [...plates];
    list[pIdx].filaments = list[pIdx].filaments.filter((_, i) => i !== fIdx);
    setPlates(list);
  }
  function addAccessory() {
    if (!accSelected) return;
    setAccessories((prev) => [
      ...prev,
      { name: accSelected!.name, quantity: Math.max(1, toNumber(accQty)) },
    ]);
    setAccSelected(null);
    setAccQty("1");
  }
  function removeAccessory(idx: number) {
    setAccessories((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSave() {
    if (saving) return;
    if (!name.trim()) return Alert.alert("Erro", "Nome obrigatório");
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const globalYield = Math.max(1, toNumber(productYield));

      // Salva o Yield Global dentro de cada plate para manter compatibilidade
      const platesToSave = plates.map((p) => ({
        ...p,
        unitsOnPlate: globalYield,
      }));

      const base: Product = {
        id: id ?? uid(),
        name: name.trim(),
        description: description.trim() || undefined,
        priceBRL: toNumber(price),
        plates: platesToSave,
        accessories,
        status: "ready",
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
          base.startedAt = old.startedAt;
          base.finishedAt = old.finishedAt;
        }
      }
      await ProductRepository.upsert(base);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Foto ---
  function getAppDir(): string | null {
    const doc = (FileSystem as any).documentDirectory ?? null;
    return doc;
  }
  async function persistOrFallback(uri: string): Promise<string> {
    const appDir = getAppDir();
    if (!appDir) return uri;
    try {
      const ext = uri.split(".").pop() || "jpg";
      const dest = `${appDir}product_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
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
      if ((await permFunc()).status !== ImagePicker.PermissionStatus.GRANTED)
        return Alert.alert("Permissão necessária");
      const r =
        source === "gallery"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: (ImagePicker as any).MediaTypeOptions.Images,
              quality: 0.85,
              allowsEditing: true,
              aspect: [1, 1],
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: (ImagePicker as any).MediaTypeOptions.Images,
              quality: 0.85,
              allowsEditing: true,
              aspect: [1, 1],
            });
      if (!r.canceled && r.assets?.[0]?.uri)
        setPhotoUri(await persistOrFallback(r.assets[0].uri));
    } catch (e) {}
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
              {isEdit ? "Editar" : "Novo"} Produto
            </Text>
            <Pressable
              onPress={() => navigation.navigate("CostParameters" as never)}
            >
              <MaterialIcons name="settings" size={24} color={colors.primary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 3 }}>
              <AppInput
                label="Nome"
                value={name}
                onChangeText={setName}
                placeholder="Ex: Chaveiro"
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Qtd Criada"
                value={productYield}
                onChangeText={setProductYield}
                keyboardType="numeric"
                placeholder="1"
              />
            </View>
          </View>

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

          {/* CALCULADORA (BATCH) */}
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
                  Material ({totalFilamentsCount} itens)
                </Text>
                <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                  {toMoney(costAnalysis.batchMaterial)}
                </Text>
              </View>

              {costAnalysis.batchAccessories > 0 && (
                <View style={styles.calcRow}>
                  <Text style={{ color: colors.textSecondary }}>
                    Acessórios ({totalAccessoryCount} un)
                  </Text>
                  <Text
                    style={{ fontWeight: "bold", color: colors.textPrimary }}
                  >
                    {toMoney(costAnalysis.batchAccessories)}
                  </Text>
                </View>
              )}

              <View style={styles.calcRow}>
                <Text style={{ color: colors.textSecondary }}>
                  Tempo Máquina ({costAnalysis.totalTimeHours.toFixed(2)}h)
                </Text>
                <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                  {toMoney(
                    costAnalysis.batchEnergy +
                      costAnalysis.batchFixed +
                      costAnalysis.batchDepreciation +
                      costAnalysis.batchFailures,
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
                  CUSTO TOTAL (LOTE)
                </Text>
                <Text style={{ fontWeight: "900", color: colors.error }}>
                  {toMoney(costAnalysis.totalBatchCost)}
                </Text>
              </View>

              {/* CUSTO UNITÁRIO - Só exibe se a Qtd Criada > 1 */}
              {costAnalysis.globalYield > 1 && (
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "rgba(33, 150, 243, 0.1)",
                    borderRadius: 8,
                  }}
                >
                  <View style={styles.calcRow}>
                    <Text style={{ fontWeight: "900", color: colors.primary }}>
                      CUSTO UNITÁRIO (x{costAnalysis.globalYield})
                    </Text>
                    <Text style={{ fontWeight: "900", color: colors.primary }}>
                      {toMoney(costAnalysis.unitCost)}
                    </Text>
                  </View>
                </View>
              )}

              <View style={{ marginTop: 8, gap: 4 }}>
                <View style={styles.calcRow}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Sugestão Consumidor (Un)
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
                    Sugestão Lojista (Un)
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
                  LUCRO REAL (UN)
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
              label="Preço Venda (Unidade)"
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

          {/* PLATES */}
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={[styles.h2, { color: colors.textPrimary }]}>
                Mesas de Impressão (Plates)
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AppButton
                  title="Importar G-code"
                  onPress={importGcodesBatch}
                  style={{ height: 36, paddingHorizontal: 12 }}
                />
                <AppButton
                  title="+ Mesa"
                  onPress={addPlate}
                  style={{ height: 36, paddingHorizontal: 12 }}
                />
              </View>
            </View>

            {plates.map((plate, idx) => {
              const h = Math.floor(plate.estimatedMinutes / 60);
              const m = plate.estimatedMinutes % 60;

              return (
                <View
                  key={plate.id}
                  style={[
                    styles.plateCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      marginBottom: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <View
                      style={[
                        styles.platePreviewBox,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.iconBg,
                        },
                      ]}
                    >
                      {platePreviews[plate.id] ? (
                        <Image
                          source={{ uri: platePreviews[plate.id] }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <MaterialIcons
                          name="image"
                          size={28}
                          color={colors.textSecondary}
                        />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flex: 2 }}>
                        <AppInput
                          label="Nome da Mesa"
                          value={plate.name}
                          onChangeText={(v) => updatePlateName(idx, v)}
                          placeholder="Ex: Corpo"
                        />
                      </View>

                      {/* Input HH:MM */}
                      <View style={{ flexDirection: "row", flex: 1.5, gap: 4 }}>
                        <View style={{ flex: 1 }}>
                          <AppInput
                            label="H"
                            value={h > 0 ? String(h) : ""}
                            onChangeText={(v) => updatePlateTime(idx, "h", v)}
                            keyboardType="numeric"
                            placeholder="0"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppInput
                            label="Min"
                            value={m > 0 ? String(m) : ""}
                            onChangeText={(v) => updatePlateTime(idx, "m", v)}
                            keyboardType="numeric"
                            placeholder="0"
                          />
                        </View>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: colors.iconBg,
                      borderRadius: 12,
                      padding: 8,
                      gap: 6,
                    }}
                  >
                    {plate.filaments.map((f, fIdx) => (
                      <View
                        key={fIdx}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: colors.textPrimary,
                            flex: 1,
                          }}
                        >
                          {f.material} {f.color}{" "}
                          <Text style={{ color: colors.textSecondary }}>
                            ({f.grams}g)
                          </Text>
                        </Text>
                        <Pressable
                          onPress={() => removeFilamentFromPlate(idx, fIdx)}
                        >
                          <MaterialIcons
                            name="close"
                            size={18}
                            color={colors.error}
                          />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => openAddFilament(idx)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      <MaterialIcons
                        name="add-circle"
                        size={20}
                        color={colors.primary}
                      />
                      <Text
                        style={{
                          color: colors.primary,
                          fontWeight: "bold",
                          fontSize: 13,
                        }}
                      >
                        Adicionar Filamento
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => removePlate(idx)}
                    style={{ alignSelf: "flex-end", marginTop: 8 }}
                  >
                    <Text
                      style={{
                        color: colors.error,
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      Remover Mesa
                    </Text>
                  </Pressable>
                </View>
              );
            })}
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
              <Text style={[styles.h2, { color: colors.textPrimary }]}>
                Acessórios (Total para o Lote)
              </Text>
              <MaterialIcons
                name={accExpanded ? "expand-less" : "expand-more"}
                size={26}
                color={colors.textPrimary}
              />
            </Pressable>
            {accExpanded && (
              <View style={{ gap: 12, marginTop: 12 }}>
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      Item
                    </Text>
                    <Pressable
                      onPress={() =>
                        openPicker("accessory", "Acessório", allAccessories)
                      }
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
                <AppButton title="Adicionar" onPress={addAccessory} />
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
                    <Text style={{ flex: 1, color: colors.textPrimary }}>
                      {a.name} (x{a.quantity})
                    </Text>
                    <Pressable onPress={() => removeAccessory(i)}>
                      <MaterialIcons
                        name="delete"
                        size={20}
                        color={colors.textPrimary}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          <AppButton
            title="Salvar Produto"
            onPress={onSave}
            disabled={saving as any}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL 1: Adicionar Filamento */}
      <Modal
        visible={filModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFilModalVisible(false)}
        >
          {/* AQUI ESTÁ A CORREÇÃO: Pressable + stopPropagation */}
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Filamento na Mesa
            </Text>
            <View style={{ gap: 12 }}>
              <View style={styles.grid2}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Material
                  </Text>
                  <Pressable
                    onPress={() =>
                      openPicker("material", "Material", materialOptions)
                    }
                    style={[styles.dropdown, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {fMaterial || "Sel."}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Cor
                  </Text>
                  <Pressable
                    onPress={() => openPicker("color", "Cor", colorOptions)}
                    style={[styles.dropdown, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {fColor || "Sel."}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.grid2}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Marca (Opc)
                  </Text>
                  <Pressable
                    onPress={() => openPicker("brand", "Marca", brandOptions)}
                    style={[styles.dropdown, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {fBrand || "Qualquer"}
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
              <AppButton title="Adicionar" onPress={confirmAddFilament} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 2: Picker Genérico */}
      <Modal
        visible={picker.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker({ ...picker, visible: false })}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPicker({ ...picker, visible: false })}
        >
          {/* AQUI ESTÁ A CORREÇÃO: Pressable + stopPropagation */}
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {picker.title}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {picker.options.map((o, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => applyPickerValue(o)}
                  style={{
                    padding: 12,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{ color: colors.textPrimary, fontWeight: "bold" }}
                  >
                    {typeof o === "string" ? o : o.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 3: Confirmação de Exclusão de Mesa */}
      <ConfirmModal
        visible={plateToDelete !== null}
        title="Remover Mesa"
        message="Tem certeza que deseja remover esta mesa de impressão e seus filamentos?"
        confirmText="Remover"
        variant="danger"
        onConfirm={confirmRemovePlate}
        onCancel={() => setPlateToDelete(null)}
      />
    </Screen>
  );
}

// --- G-CODE PARSER (Bambu/Orca/Prusa/Cura) ---
function parseGcodeTimeMinutes(content: string): number {
  // 1) Cura: ;TIME:12345 (segundos)
  const timeSecondsMatch = content.match(/;TIME:(\d+)/i);
  if (timeSecondsMatch) return Number(timeSecondsMatch[1]) / 60;

  // 2) Bambu/Orca/Prusa: ; estimated printing time (normal mode) = 54m 26s
  // ou: ; estimated printing time = 1h 2m 3s
  const estLine = content.match(/;\s*estimated\s*printing\s*time.*=\s*(.+)$/im);
  if (estLine?.[1]) {
    const t = estLine[1];
    let minutes = 0;
    const h = t.match(/(\d+)\s*h/i);
    const m = t.match(/(\d+)\s*m/i);
    const s = t.match(/(\d+)\s*s/i);
    if (h) minutes += Number(h[1]) * 60;
    if (m) minutes += Number(m[1]);
    if (s) minutes += Number(s[1]) / 60;
    if (minutes > 0) return minutes;
  }

  // 3) Prusa/Orca/Bambu: ; total estimated time = ...
  const timeStringMatch = content.match(
    /;.*(?:estimated|model|total)\s*printing\s*time\s*=\s*(.*)/i,
  );
  if (timeStringMatch?.[1]) {
    const t = timeStringMatch[1];
    let minutes = 0;
    const h = t.match(/(\d+)\s*h/i);
    const m = t.match(/(\d+)\s*m/i);
    const s = t.match(/(\d+)\s*s/i);
    if (h) minutes += Number(h[1]) * 60;
    if (m) minutes += Number(m[1]);
    if (s) minutes += Number(s[1]) / 60;
    if (minutes > 0) return minutes;
  }

  // 4) Simplify3D: ; Build time: 1 hours 20 minutes
  const buildTimeMatch = content.match(/;.*Build time:\s*(.*)/i);
  if (buildTimeMatch?.[1]) {
    const t = buildTimeMatch[1];
    let minutes = 0;
    const h = t.match(/(\d+)\s*hour/i);
    const m = t.match(/(\d+)\s*minute/i);
    if (h) minutes += Number(h[1]) * 60;
    if (m) minutes += Number(m[1]);
    if (minutes > 0) return minutes;
  }

  return 0;
}

function parseGcodeWeightGrams(
  content: string,
  filamentDiameter = 1.75,
  filamentDensity = 1.24,
): number {
  const calculateWeightFromLengthMm = (lengthMm: number) => {
    const radius = filamentDiameter / 2;
    const areaMm2 = Math.PI * Math.pow(radius, 2);
    const volumeCm3 = (areaMm2 * lengthMm) / 1000; // mm³ -> cm³
    return volumeCm3 * filamentDensity;
  };

  // Bambu header: ; total filament weight [g] : 18.93
  const bambuWeight = content.match(
    /;\s*total\s*filament\s*weight\s*\[g\]\s*:\s*([\d.]+)/i,
  );
  if (bambuWeight) return Number(bambuWeight[1]);

  // Prusa/Orca/Bambu: ; filament used [g] = 12.3  OR total filament used [g] =
  const weightMatch = content.match(
    /;.*(?:total\s*)?filament\s*used\s*\[g\]\s*[=:]\s*([\d.]+)/i,
  );
  if (weightMatch) return Number(weightMatch[1]);

  // Genérico: ; weight = 12.34 g
  const genericWeightMatch = content.match(
    /;.*(?:total\s*)?weight\s*=\s*([\d.]+)\s*g/i,
  );
  if (genericWeightMatch) return Number(genericWeightMatch[1]);

  // Cura (metros): ;Filament used: 1.23m
  const lengthMatchM = content.match(/;.*Filament used:\s*([\d.]+)m/i);
  if (lengthMatchM)
    return calculateWeightFromLengthMm(Number(lengthMatchM[1]) * 1000);

  // Prusa/Orca (mm): ; filament used [mm] = 1234.5
  const lengthMatchMm = content.match(
    /;.*filament used\s*\[mm\]\s*=\s*([\d.]+)/i,
  );
  if (lengthMatchMm)
    return calculateWeightFromLengthMm(Number(lengthMatchMm[1]));

  // Bambu length mm: ; total filament length [mm] : 6398.64
  const bambuLen = content.match(
    /;\s*total\s*filament\s*length\s*\[mm\]\s*:\s*([\d.]+)/i,
  );
  if (bambuLen) return calculateWeightFromLengthMm(Number(bambuLen[1]));

  return 0;
}

function parseBambuFilamentInfo(content: string): {
  material?: string;
  brand?: string;
  colorHex?: string;
  activeIndex: number;
} {
  // Ex:
  // ; filament_type = PLA;PLA;PLA;PLA
  // ; filament_vendor = SUNLU;Generic;Generic;Polymaker
  // ; filament_colour = #F72323;#BCBCBC;#7C4B00;#898989
  // ; filament: 1
  const activeMatch = content.match(/^\s*;\s*filament\s*:\s*(\d+)/im);
  const activeRaw = activeMatch ? Number(activeMatch[1]) : 1;
  const activeIndex = Math.max(
    0,
    (Number.isFinite(activeRaw) ? activeRaw : 1) - 1,
  );

  const typesLine =
    content.match(/^\s*;\s*filament_type\s*=\s*(.+)$/im)?.[1] ?? "";
  const vendorLine =
    content.match(/^\s*;\s*filament_vendor\s*=\s*(.+)$/im)?.[1] ?? "";
  const colorLine =
    content.match(/^\s*;\s*filament_colou?r\s*=\s*(.+)$/im)?.[1] ?? "";

  const types = typesLine
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const vendors = vendorLine
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const colors = colorLine
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const material = types[activeIndex] ?? types[0];
  const brand = vendors[activeIndex] ?? vendors[0];
  const colorHex = colors[activeIndex] ?? colors[0];

  return { material, brand, colorHex, activeIndex };
}

// Extrai thumbnail embutida no G-code (Bambu/Orca/Prusa). Retorna a maior encontrada (data URI).
function extractGcodeThumbnailDataUri(
  content: string,
): { dataUri: string; width: number; height: number } | null {
  const lines = content.split(/\r?\n/);

  const beginRe =
    /^\s*;\s*thumbnail(?:_JPG|_PNG)?\s+begin\s+(\d+)\s*x\s*(\d+)/i;
  const endRe = /^\s*;\s*thumbnail(?:_JPG|_PNG)?\s+end/i;

  const blocks: Array<{ w: number; h: number; mime: string; b64: string }> = [];
  let collecting = false;
  let cur: { w: number; h: number; mime: string; b64: string } | null = null;

  for (const line of lines) {
    const begin = line.match(beginRe);
    if (begin) {
      collecting = true;
      cur = {
        w: Number(begin[1]),
        h: Number(begin[2]),
        mime: /thumbnail_jpg/i.test(line) ? "image/jpeg" : "image/png",
        b64: "",
      };
      continue;
    }
    if (collecting && endRe.test(line)) {
      collecting = false;
      if (cur && cur.b64.length > 0) blocks.push(cur);
      cur = null;
      continue;
    }
    if (collecting && cur) {
      const cleaned = line.replace(/^\s*;\s?/, "").trim();
      if (cleaned) cur.b64 += cleaned;
    }
  }

  if (blocks.length === 0) return null;
  blocks.sort((a, b) => b.w * b.h - a.w * a.h);
  const best = blocks[0];

  // valida base64 minimamente
  if (!/^[A-Za-z0-9+/=]+$/.test(best.b64)) return null;

  return {
    dataUri: `data:${best.mime};base64,${best.b64}`,
    width: best.w,
    height: best.h,
  };
}

function getRelevantHeaderLines(content: string, limit = 80): string[] {
  // para debug: pega só as linhas do começo que costumam trazer metadata
  const lines = content.split(/\r?\n/).slice(0, 700);
  const out: string[] = [];
  const keep =
    /(estimated printing time|TIME:|filament_(type|vendor|colou?r)|total filament|filament used|thumbnail|filament:)/i;
  for (const l of lines) {
    if (keep.test(l)) out.push(l);
    if (out.length >= limit) break;
  }
  return out;
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
  plateCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  platePreviewBox: {
    width: 86,
    height: 86,
    borderRadius: 14,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
});
