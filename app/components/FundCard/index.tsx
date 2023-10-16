import { useEffect, useState } from 'react'
import Link from 'next/link'
import copy from 'copy-to-clipboard'
import { Card, Text, Spacer, Description, useToasts } from '@geist-ui/core'
import { Copy } from '@geist-ui/icons'
import { TokenListProvider, TokenInfo, ENV } from '@solana/spl-token-registry'
import LockStatus from './LockStatus'
import Ellipsis from '../Ellipsis'

interface FundCardProps {
  fund: Fund
}

const FundCard = ({ fund }: FundCardProps) => {
  const { setToast } = useToasts()

  const [token, setToken] = useState<TokenInfo | null>(null)

  useEffect(() => {
    new TokenListProvider().resolve().then(tokens => {
      const tokenList = tokens
        .filterByChainId(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '') || ENV.Devnet)
        .getList()

      const token = tokenList.filter(token => {
        return token.address == fund.mint.toString()
      })?.[0]

      setToken(token)
    })
  }, [setToken, fund])

  return (
    <Card
      hoverable
      width="100%"
      marginBottom="20px"
      key={fund.address.toString()}
      style={{ position: 'relative' }}
    >
      <Link href={`/fund/${fund.address.toString()}`} passHref>
        <a>
          <Text h4 my={0}>
            {fund.name || 'Fund'}
          </Text>
        </a>
      </Link>
      <LockStatus fund={fund} />
      <Spacer h={1} />
      <Description
        title="Amount"
        content={
          <Ellipsis>
            {fund.currentAmount.uiAmountString} {token?.symbol || fund.mint.toString()}
          </Ellipsis>
        }
      />
      <Spacer h={1} />
      <Description
        title="Redeemer"
        content={
          <Ellipsis
            style={{
              cursor: 'pointer',
            }}
            onClick={() => {
              copy(fund.redeemer.toString())
              setToast({ text: 'Redeemer address copied', delay: 2000 })
            }}
          >
            {fund.redeemer.toString()}
          </Ellipsis>
        }
      />
      <Spacer h={1} />
      <Description
        title="Redeem time"
        content={new Date(fund.redeemTimestamp * 1000).toLocaleString()}
      />
      <Card.Footer>
        <div
          style={{
            cursor: 'pointer',
          }}
          onClick={() => {
            copy(
              `${
                process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
              }/fund/${fund.address.toString()}`,
            )
            setToast({ text: 'Fund link copied', delay: 2000 })
          }}
        >
          Share fund <Copy size="12px" />
        </div>
      </Card.Footer>
    </Card>
  )
}

export default FundCard
