import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { colors, radius } from '../lib/theme';

interface Suggestions {
  products: { name: string; slug: string; images: { url: string }[] }[];
  categories: { name: string; slug: string }[];
}

export default function Search() {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState<Suggestions | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSugg(null);
      return;
    }
    const t = setTimeout(() => {
      api<Suggestions>(`/products/suggest?q=${encodeURIComponent(term)}`, { auth: false }).then(setSugg).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = () => {
    const term = q.trim();
    if (term) router.replace({ pathname: '/products', params: { q: term } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 12 }}>
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Search for products, brands…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          onSubmitEditing={submit}
          style={s.input}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        {sugg?.categories.map((c) => (
          <Pressable key={c.slug} style={s.row} onPress={() => router.replace({ pathname: '/products', params: { category: c.slug, title: c.name } })}>
            <Text style={s.text}>{c.name}</Text>
            <Text style={{ color: colors.muted }}>Category</Text>
          </Pressable>
        ))}
        {sugg?.products.map((p) => (
          <Pressable key={p.slug} style={s.row} onPress={() => router.replace(`/p/${p.slug}`)}>
            <Image source={p.images[0]?.url} style={s.thumb} />
            <Text style={[s.text, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
          </Pressable>
        ))}
        {q.trim().length >= 2 && (
          <Pressable style={s.row} onPress={submit}>
            <Text style={[s.text, { color: colors.brand, fontWeight: '700' }]}>See all results for “{q.trim()}”</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 46, paddingHorizontal: 12, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  text: { fontSize: 15, color: colors.text },
  thumb: { width: 36, height: 44, borderRadius: 4, backgroundColor: colors.page },
});
