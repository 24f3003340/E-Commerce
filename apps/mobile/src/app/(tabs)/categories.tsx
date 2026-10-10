import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, Loading } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { Category } from '../../lib/types';

export default function Categories() {
  const [tree, setTree] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const load = () => api<Category[]>('/categories', { auth: false }).then(setTree).catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    void load();
  }, []);

  if (error && !tree) return <Empty title="Could not load categories" subtitle={error} action={<Button title="Retry" onPress={() => void load()} />} />;
  if (!tree) return <Loading />;
  const root = tree[active];
  const open = (c: Category) => router.push({ pathname: '/products', params: { category: c.slug, title: c.name } });

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <ScrollView style={s.side}>
        {tree.map((c, i) => (
          <Pressable key={c.id} onPress={() => setActive(i)} style={[s.sideItem, i === active && s.sideActive]}>
            {c.imageUrl ? <Image source={c.imageUrl} style={s.sideImg} /> : null}
            <Text style={[s.sideText, i === active && { color: colors.brand, fontWeight: '700' }]}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {root && (
          <>
            <Pressable style={s.all} onPress={() => open(root)}>
              <Text style={{ color: colors.brand, fontWeight: '700' }}>Shop all {root.name} ›</Text>
            </Pressable>
            {root.children.map((c) => (
              <View key={c.id} style={{ marginBottom: 8 }}>
                <Pressable style={s.child} onPress={() => open(c)}>
                  <Text style={s.childText}>{c.name}</Text>
                  <Text style={{ color: colors.muted }}>›</Text>
                </Pressable>
                {c.children.map((g) => (
                  <Pressable key={g.id} style={[s.child, { paddingLeft: 24 }]} onPress={() => open(g)}>
                    <Text style={{ color: colors.text }}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  side: { maxWidth: 104, backgroundColor: colors.page, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sideItem: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 },
  sideActive: { backgroundColor: '#fff', borderLeftWidth: 3, borderColor: colors.brand },
  sideImg: { width: 48, height: 48, borderRadius: 24, marginBottom: 6 },
  sideText: { fontSize: 12, textAlign: 'center', color: colors.text },
  all: { paddingVertical: 10 },
  child: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 6 },
  childText: { fontWeight: '600', color: colors.text },
});
