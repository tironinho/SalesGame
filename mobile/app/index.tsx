import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { colors, radii, spacing } from '../constants/theme';

const MIN_NAME_LENGTH = 2;
const CONFIRMATION_MS = 2500;

function validateName(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length < MIN_NAME_LENGTH) {
    return 'Digite um nome com pelo menos 2 caracteres.';
  }

  return null;
}

export default function Index() {
  const { width } = useWindowDimensions();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [howToPlayVisible, setHowToPlayVisible] = useState(false);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentWidth = Math.min(width - spacing.lg * 2, 480);

  useEffect(() => {
    return () => {
      if (confirmationTimer.current) {
        clearTimeout(confirmationTimer.current);
      }
    };
  }, []);

  function handleContinue() {
    const validationError = validateName(name);

    if (validationError) {
      setError(validationError);
      setConfirmation(null);
      return;
    }

    const trimmedName = name.trim();
    setName(trimmedName);
    setError(null);
    setConfirmation(`Olá, ${trimmedName}! Nome confirmado.`);

    if (confirmationTimer.current) {
      clearTimeout(confirmationTimer.current);
    }

    confirmationTimer.current = setTimeout(() => {
      setConfirmation(null);
    }, CONFIRMATION_MS);
  }

  function handleNameChange(value: string) {
    setName(value);

    if (error) {
      setError(validateName(value));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { width: contentWidth }]}>
            <Text style={styles.title}>SalesGame</Text>
            <Text style={styles.subtitle}>
              Jogo de estratégia e gestão comercial
            </Text>

            <Text style={styles.body}>
              Nesta partida, você administrará uma empresa: tomará decisões
              comerciais, equilibrará recursos e competirá pelo melhor resultado.
            </Text>

            <View style={styles.infoBlock}>
              <Text style={styles.infoText}>
                A quantidade de rodadas será definida pelo host, entre 1 e 5. Ao
                final da partida, vence o jogador com o maior caixa.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Digite seu nome</Text>
              <TextInput
                value={name}
                onChangeText={handleNameChange}
                placeholder="Seu nome"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                accessibilityLabel="Digite seu nome"
                style={[styles.input, error ? styles.inputError : null]}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            {confirmation ? (
              <View style={styles.confirmationBox}>
                <Text style={styles.confirmationText}>{confirmation}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setHowToPlayVisible(true)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Como jogar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <HowToPlayModal
        visible={howToPlayVisible}
        onClose={() => setHowToPlayVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  content: {
    gap: spacing.md,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: -spacing.xs,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  infoBlock: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? 14 : 12,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
  },
  confirmationBox: {
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmationText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.success,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    color: colors.secondaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
