import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

type HowToPlayModalProps = {
  visible: boolean;
  onClose: () => void;
};

const SECTIONS = [
  {
    title: 'Objetivo da partida',
    body: 'A quantidade de rodadas será definida pelo host, entre 1 e 5. Ao final da partida, vence o jogador com o maior caixa.',
  },
  {
    title: 'Turnos e rodadas',
    body: 'A quantidade de rodadas será definida pelo host, entre 1 e 5. Em cada rodada, os jogadores alternam turnos para avançar no tabuleiro, resolver eventos e gerir a operação.',
  },
  {
    title: 'Caixa e patrimônio',
    body: 'O caixa é o dinheiro disponível para pagar despesas e investir. O patrimônio representa o valor acumulado da empresa ao longo da partida.',
  },
  {
    title: 'Faturamento e despesas',
    body: 'O faturamento traz receita para o caixa. As despesas operacionais reduzem o caixa e exigem planejamento para manter a empresa saudável.',
  },
  {
    title: 'Capacidade de atendimento',
    body: 'A capacidade define quantos clientes sua equipe consegue atender bem. Equilibrar vendedores, gestores e estrutura evita perda de desempenho.',
  },
  {
    title: 'Empréstimos',
    body: 'Em situações de aperto, é possível pegar empréstimo para reforçar o caixa. Isso aumenta a dívida e precisa ser considerado nas próximas rodadas.',
  },
] as const;

export function HowToPlayModal({ visible, onClose }: HowToPlayModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>Como jogar</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  closeButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
