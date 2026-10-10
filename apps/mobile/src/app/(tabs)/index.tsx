import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../../components/ProductCard';
import { Loading, styles as ui } from '../../components/ui';
import { api } from '../../lib/api';
import { STORE_NAME } from '../../lib/config';
import { colors, radius } from '../../lib/theme';
import type { Banner, Category, ListingProduct, ProductListResponse } from '../../lib/types';

interface HomeData {
  banners: Banner[];
  categories: Category[];
  featured: ListingProduct[];
  latest: ListingProduct[];
  popular: ListingProduct[];
}

/** Banner links point at website paths (/c/men, /search?q=…); map them to app screens. */
function openWebPath(link: string | null) {
  if (!link) return;
  const url = new URL(link, 'https://app.local');
  const [, first, second] = url.pathname.split('/');
  if (first === 'c' && second) router.push({ pathname: '/products', params: { category: second } });
  else if (first === 'p' && second) router.push(`/p/${second}`);
  else if (first === 'search') router.push({ pathname: '/products', params: { q: url.searchParams.get('q') ?? '' } });
  else router.push('/products');
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [banners, categories, featured, latest, popular] = await Promise.all([
        api<Banner[]>('/banners', { auth: false }),
        api<Category[]>('/categories', { auth: false }),
        api<ProductListResponse>('/products?featured=true&limit=10', { auth: false }),
        api<ProductListResponse>('/products?sort=newest&limit=10', { auth: false }),
        api<ProductListResponse>('/products?sort=popular&limit=10', { auth: false }),
      ]);
      setData({ banners, categories, featured: featured.items, latest: latest.items, popular: popular.items });
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cardWidth = Math.min(170, (width - 40) / 2.3);
  const hero = data?.banners.filter((b) => b.position === 'HERO') ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Image source={require('../../../assets/logo-on-dark.png')} style={s.logo} contentFit="contain" accessibilityLabel={STORE_NAME} />
        <Pressable style={s.search} onPress={() => router.push('/search')}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <Text style={{ color: colors.muted, marginLeft: 8 }}>Search for products, brands…</Text>
        </Pressable>
      </View>
      {!data && !error ? (
        <Loading />
      ) : error && !data ? (
        <Pressable style={ui.center} onPress={() => void load()}>
          <Text style={ui.emptyTitle}>Could not load the store</Text>
          <Text style={ui.emptySub}>Check your internet connection and tap to retry.</Text>
        </Pressable>
      ) : data ? (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {hero.length > 0 && (
            <FlatList
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={hero}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => openWebPath(item.linkUrl)} style={{ width }}>
                  <Image source={item.imageUrl} style={{ width, height: width * 0.5 }} contentFit="cover" />
                  <View style={s.bannerText}>
                    <Text style={s.bannerTitle}>{item.title}</Text>
                    {item.subtitle ? <Text style={s.bannerSub}>{item.subtitle}</Text> : null}
                  </View>
                </Pressable>
              )}
            />
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats}>
            {data.categories.map((c) => (
              <Pressable key={c.id} style={s.cat} onPress={() => router.push({ pathname: '/products', params: { category: c.slug, title: c.name } })}>
                <View style={s.catImage}>
                  {c.imageUrl ? <Image source={c.imageUrl} style={{ width: 64, height: 64 }} /> : <Text style={{ fontSize: 22 }}>{c.name[0]}</Text>}
                </View>
                <Text style={s.catName} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Rail title="Featured" items={data.featured} width={cardWidth} params={{ featured: 'true', title: 'Featured' }} />
          <Rail title="Trending now" items={data.popular} width={cardWidth} params={{ sort: 'popular', title: 'Trending now' }} />
          <Rail title="New arrivals" items={data.latest} width={cardWidth} params={{ sort: 'newest', title: 'New arrivals' }} />
        </ScrollView>
      ) : null}
    </View>
  );
}

function Rail({ title, items, width, params }: { title: string; items: ListingProduct[]; width: number; params: Record<string, string> }) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <View style={s.railHead}>
        <Text style={ui.sectionTitle}>{title}</Text>
        <Pressable onPress={() => router.push({ pathname: '/products', params })}>
          <Text style={{ color: colors.brand, fontWeight: '700' }}>View all</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
        renderItem={({ item }) => <ProductCard product={item} width={width} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.brandDark, paddingHorizontal: 12, paddingBottom: 12 },
  logo: { height: 28, aspectRatio: 5.708, alignSelf: 'flex-start', marginBottom: 10 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, height: 42, paddingHorizontal: 12 },
  bannerText: { position: 'absolute', left: 16, bottom: 16, right: 16 },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6 },
  bannerSub: { color: '#fff', fontSize: 13, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6 },
  cats: { paddingHorizontal: 12, paddingTop: 14, gap: 14 },
  cat: { alignItems: 'center', width: 72 },
  catImage: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  catName: { marginTop: 6, fontSize: 12, fontWeight: '600', color: colors.text },
  railHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
});
