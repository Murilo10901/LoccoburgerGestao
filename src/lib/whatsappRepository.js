import { supabase } from './supabaseClient.js'
import { getDataOwnerId } from './tenantRepository.js'

function mapWhatsAppMessageFromSupabase(message) {
  return {
    id: message.id,
    messageId: message.message_id,
    fromPhone: message.from_phone,
    customerName: message.customer_name ?? '',
    phoneNumberId: message.phone_number_id ?? '',
    displayPhoneNumber: message.display_phone_number ?? '',
    messageType: message.message_type ?? 'text',
    body: message.body ?? '',
    status: message.status ?? 'pendente',
    receivedAt: message.received_at,
    rawPayload: message.raw_payload ?? {},
  }
}

export async function loadWhatsAppMessages() {
  const ownerId = await getDataOwnerId()
  if (!ownerId || !supabase) {
    return { ok: false, message: 'Entre no sistema para carregar mensagens do WhatsApp.', messages: [] }
  }

  const { data, error } = await supabase
    .from('user_whatsapp_messages')
    .select('*')
    .eq('user_id', ownerId)
    .order('received_at', { ascending: false })
    .limit(50)

  if (error) {
    return { ok: false, message: `WhatsApp ainda nao disponivel no Supabase: ${error.message}`, messages: [] }
  }

  return {
    ok: true,
    hasData: data.length > 0,
    messages: data.map(mapWhatsAppMessageFromSupabase),
  }
}

export async function updateWhatsAppMessageStatus(messageId, status) {
  const ownerId = await getDataOwnerId()
  if (!ownerId || !supabase) {
    return { ok: false, message: 'Entre no sistema para atualizar a mensagem.' }
  }

  const { error } = await supabase
    .from('user_whatsapp_messages')
    .update({ status })
    .eq('user_id', ownerId)
    .eq('id', messageId)

  if (error) {
    return { ok: false, message: `Erro ao atualizar WhatsApp: ${error.message}` }
  }

  return { ok: true, message: 'Mensagem atualizada.' }
}
