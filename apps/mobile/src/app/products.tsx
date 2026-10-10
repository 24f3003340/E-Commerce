import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductCard } from '../components/ProductCard';
import { Button, Chip, Empty, Loading, styles as ui } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { colors } from '../lib/theme';
import type { Facets, ListingProduct, ProductListResponse } from '../lib/types';

const SORTS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Discount' },
  { value: 'rating', label: 'Rating' },
];

interface Filters {
  sort: string;
  size: string[];
  color: string[];
  brand: string[];
}

export default function Products() {
  const params = useLocalSearchParams<{ category?: string; q?: string; sort?: string; featured?: string; title?: string }>();
  const [filters, setFilters] = useState<Filters>({ sort: params.sort ?? 'newest', size: [], color: [], brand: [] });
  const [items, setItems] = useState<ListingProduct[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'sort' | 'filter' | null>(null);
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (next: number) => {
      const id = ++requestId.current;
      setLoading(true);
      const qs = new URLSearchParams({ page: String(next), limit: '20', sort: filters.sort });
      if (params.category) qs.set('category', params.category);
      if (params.q) qs.set('q', params.q);
      if (params.featured) qs.set('featured', 'true');
      if (filters.size.length) qs.set('size', filters.size.join(','));
      if (filters.color.length) qs.set('color', filters.color.join(','));
      if (filters.brand.length) qs.set('brand', filters.brand.join(','));
      try {
        const res = await api<ProductListResponse>(`/products?${qs}`, { auth: false });
        if (id !== requestId.current) return;
        setItems((prev) => (next === 1 ? res.items : [...prev, ...res.items]));
        setFacets((prev) => (next === 1 ? res.facets : prev));
        setPage(res.page);
        setPages(res.pages);
        setTotal(res.total);
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError(errorMessage(err));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [filters, params.category, params.q, params.featured],
  );

  useEffect(() => {
    void fetchPage(1);
  }, [fetchPage]);

  const title = params.title ?? (params.q ? `“${params.q}”` : 'Products');
  const activeFilters = filters.size.length + filters.color.length + filters.brand.length;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title }} />
      <View style={s.bar}>
        <Text style={{ color: colors.muted }}>{total.toLocaleString('en-IN')} items</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Sort" onPress={() => setSheet('sort')} />
          <Chip label={activeFilters ? `Filter (${activeFilters})` : 'Filter'} active={activeFilters > 0} onPress={() => setSheet('filter')} />
        </View>
      </View>
      {loading && page === 1 && items.length === 0 ? (
        <Loading />
      ) : error && items.length === 0 ? (
        <Empty title="Could not load products" subtitle={error} action={<Button title="Retry" onPress={() => void fetchPage(1)} />} />
      ) : items.length === 0 ? (
        <Empty title="No products found" subtitle="Try a different search or remove some filters." />
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 10, gap: 10 }}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (!loading && page < pages) void fetchPage(page + 1);
          }}
          ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color={colors.brand} /> : null}
        />
      )}

      <Modal visible={sheet !== null} animationType="slide" transparent onRequestClose={() => setSheet(null)}>
        <Pressable style={s.backdrop} onPress={() => setSheet(null)} />
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          {sheet === 'sort' ? (
            <View>
              <Text style={ui.sectionTitle}>Sort by</Text>
              {SORTS.map((o) => (
                <Pressable
                  key={o.value}
                  style={s.sortRow}
                  onPress={() => {
                    setFilters((f) => ({ ...f, sort: o.value }));
                    setSheet(null);
                  }}
                >
                  <Text style={{ fontSize: 16, color: filters.sort === o.value ? colors.brand : colors.text, fontWeight: filters.sort === o.value ? '700' : '400' }}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <FilterSheet facets={facets} filters={filters} onApply={(f) => { setFilters(f); setSheet(null); }} />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function FilterSheet({ facets, filters, onApply }: { facets: Facets | null; filters: Filters; onApply: (f: Filters) => void }) {
  const [draft, setDraft] = useState(filters);
  const toggle = (key: 'size' | 'color' | 'brand', value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value] }));
  return (
    <View style={{ maxHeight: 520 }}>
      <ScrollView>
        {!!facets?.sizes.length && (
          <Group title="Size">
            {facets.sizes.map((v) => <Chip key={v} label={v} active={draft.size.includes(v)} onPress={() => toggle('size', v)} />)}
          </Group>
        )}
        {!!facets?.colors.length && (
          <Group title="Colour">
            {facets.colors.map((c) => <Chip key={c.name} label={c.name} active={draft.color.includes(c.name)} onPress={() => toggle('color', c.name)} />)}
          </Group>
        )}
        {!!facets?.brands.length && (
          <Group title="Brand">
            {facets.brands.map((b) => <Chip key={b} label={b} active={draft.brand.includes(b)} onPress={() => toggle('brand', b)} />)}
          </Group>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Button title="Clear" variant="outline" style={{ flex: 1 }} onPress={() => onApply({ ...draft, size: [], color: [], brand: [] })} />
        <Button title="Apply" style={{ flex: 1 }} onPress={() => onApply(draft)} />
      </View>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={ui.sectionTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sortRow: { paddingVertical: 12 },
});
