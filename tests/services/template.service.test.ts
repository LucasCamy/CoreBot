import { describe, it, expect } from 'vitest';
import { MessageTemplateService } from '../../src/services/template.service.js';

describe('MessageTemplateService', () => {
  const service = new MessageTemplateService();

  it('should correctly replace single and multiple placeholders', () => {
    const template = '👋 Olá {userMention}, bem-vindo ao {channel} no {server}!';
    const context = {
      userMention: '<@123456>',
      channel: 'Geral',
      server: 'Servidor Privado',
    };

    const result = service.renderText(template, context);
    expect(result).toBe('👋 Olá <@123456>, bem-vindo ao Geral no Servidor Privado!');
  });

  it('should leave unknown placeholders untouched', () => {
    const template = 'Olá {user}, seu código é {code}!';
    const context = {
      user: 'Alice',
    };

    const result = service.renderText(template, context);
    expect(result).toBe('Olá Alice, seu código é {code}!');
  });

  it('should render an embed message when useEmbed is true', () => {
    const template = 'Parabéns {user}! Você tem {idade} anos.';
    const context = {
      user: 'Bob',
      idade: 25,
    };

    const rendered = service.renderMessage(template, context, {
      useEmbed: true,
      embedTitle: '🎉 Aniversário!',
      embedColor: '#FF5733',
    });

    expect(rendered.content).toBeUndefined();
    expect(rendered.embeds).toBeDefined();
    expect(rendered.embeds?.length).toBe(1);
    expect(rendered.embeds?.[0].data.title).toBe('🎉 Aniversário!');
    expect(rendered.embeds?.[0].data.description).toBe('Parabéns Bob! Você tem 25 anos.');
  });

  it('should render plain text when useEmbed is false', () => {
    const template = 'Aviso: {channel} está em manutenção.';
    const context = { channel: '#geral' };

    const rendered = service.renderMessage(template, context, {
      useEmbed: false,
    });

    expect(rendered.content).toBe('Aviso: #geral está em manutenção.');
    expect(rendered.embeds).toBeUndefined();
  });

  it('should validate placeholders against allowed list', () => {
    const template = '{user} entrou em {channel} às {time}. Valor extra: {hack}';
    const allowed = ['user', 'channel', 'time'];

    const validation = service.validatePlaceholders(template, allowed);
    expect(validation.valid).toBe(false);
    expect(validation.invalidPlaceholders).toEqual(['hack']);
  });
});
