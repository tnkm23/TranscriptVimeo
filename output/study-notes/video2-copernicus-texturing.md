# 2 | Copernicus Texturing

## 学習ノート

### 概要
このビデオでは、Houdini の **Copernicus** を使用して、破壊シミュレーションから高品質な地面衝突テクスチャを生成する方法を解説しています。**Height（高さ）**、**Normal（法線）**、**Roughness（粗さ）**、**Ambient Occlusion（環境遮蔽）** マップを作成し、プロシージャルな強化を加えてUnreal Engineで使用できる形式にエクスポートする完全なワークフローを学びます。

## 重要な概念

### **Rasterize（ラスタライズ）**
- **破壊シミュレーションのジオメトリ**を2Dテクスチャ空間に変換
- **Position（位置）属性**をデフォルトで使用
- **Active属性**も利用可能（RBDシミュレーションから取得）

### **Channel Split（チャンネル分離）**
- RGBチャンネルを個別に分離
- **Blue チャンネル = Depth情報**を抽出
- Equalizeで適切な範囲にスケーリング

### **Height Map（高さマップ）**
- **白 = 平坦な領域**
- **黒に近づくほど深い**
- シミュレーションの深度情報を視覚的に表現

### **Preview Material（プレビューマテリアル）**
- テクスチャを実際のジオメトリ上で確認
- **Divisions: 1000**で高解像度プレビュー
- **Height Scale & Normal Map Scale: 0.1**で適切な高さ調整
- テクスチャビューよりも実際の見た目を把握しやすい

### **プロシージャルなディテール追加**
- **大規模：**破壊シミュレーション自体
- **中規模：**Voronoi テクスチャ（ひび割れ）
- **小規模：**Megascans テクスチャ（細かい損傷）

### **SDF Shape（符号付き距離場）**
- **Circle SDF**で中央を低くする形状を作成
- **SDF to Mono**で単一値に変換
- **Distort + Fractal Noise**で有機的な形状に変形
- **Blur**でエッジを滑らかに

### **レイヤリング手法**
1. **基本高さ**：シミュレーションからの深度
2. **中央を下げる**：SDF + Subtract で中心部を深く
3. **細かいディテール**：Megascans アスファルトテクスチャ
4. **中規模のひび割れ**：Voronoi + 歪み

### **マップ生成パイプライン**

#### **Height to Normal**
- 高さマップから**法線マップ**を自動生成
- サーフェスの向きを計算

#### **Height to Ambient Occlusion**
- 高さマップから**環境遮蔽**を生成
- 窪みを暗く、出っ張りを明るく
- Remapで**コントラスト調整**

#### **Roughness Map（粗さマップ）**
- Megascans テクスチャをベースに使用
- **Mask で適用範囲を制御**
- ゲームエンジンでの適切な値にRemap

## 実装手順

### 1. ジオメトリのラスタライズ
1. **Rasterize Setup**ノードを配置
2. デフォルト設定で問題なし
3. **Rasterize Geo**ノードを接続
4. **Position属性**を選択（デフォルト）

### 2. 深度情報の抽出
1. **Channel Split**ノードを接続
2. **Blue チャンネル**（深度情報）を使用
3. **Equalize**で適切な範囲にスケール
4. これが**基本の高さマップ**になる

### 3. プレビューマテリアルのセットアップ
1. **Preview Material**ノードを作成
2. Divisions = **1000**
3. Height Scale = **0.1**
4. Normal Map Scale = **0.1**
5. 高さマップをHeightに接続して視覚的に確認

### 4. 中央を低くする（オプション）
1. **SDF Shape（Circle）**を作成
2. **SDF to Mono**で変換
3. **Blur**でエッジを滑らかに
4. **Fractal Noise**を作成し、Slope Directionに設定
5. **Distort**でCircleを歪める
6. **Blend（Subtract モード）**で元の高さから減算
   - これにより中央がさらに深くなる

### 5. 細かいディテールの追加
1. **Megascans のアスファルトテクスチャ**をインポート
2. **Red チャンネル**を抽出
3. **Transform 2D**でスケール調整
4. **Remap**で暗い部分をより暗く
5. **Convert to Mono**
6. **Invert**（反転）
7. **Subtract（0.02の値）**で元の高さから減算
8. **SDF Mask**を使用して適用範囲を制限

### 6. 中規模のひび割れ追加
1. **Fractal Noise（Worley Cellular）**でVoronoiパターン作成
2. **Remap**でエッジだけを残す
3. **別のFractal Noise**でSlope Directionを作成
4. **Distort**でエッジを歪める
5. **Gamma調整**
6. **別のFractal Noise**で乗算（強度の変動を追加）
7. **Subtract（0.3の値）**で減算

### 7. 各種マップの生成
1. **Height Map**：そのまま出力
2. **Normal Map**：**Height to Normal**ノードで生成
3. **Ambient Occlusion**：
   - **Height to AO**ノードで生成
   - **Remap**でコントラスト調整
   - これをDiffuse Mapとしても使用可能
4. **Roughness Map**：
   - Megascans テクスチャ × Mask
   - **Remap**で適切な粗さ値に調整

### 8. エクスポート
1. **ROP Image Output**ノードを各マップ用に作成
   - Diffuse
   - Roughness
   - Normal
   - Height
   - Mask
2. **効率化のコツ**：
   - **ROP Network**を作成
   - 各出力を**Fetch**ノードで取得
   - **Merge**ノードで結合
   - 1回のレンダーで全マップを出力
3. **ゲーム用ベストプラクティス**：
   - マップを**チャンネルパック**（R, G, Bに分けて保存）
   - ファイルサイズとメモリ効率を最適化

## 応用方法

### プロシージャルテクスチャパイプライン
- **シミュレーション → Copernicus → ゲームエンジン**の完全な自動化
- パラメータ調整だけで無限のバリエーション生成
- イテレーション速度が劇的に向上

### 複数レイヤーのディテール制御
- **大・中・小の3レベル**でディテールを階層的に管理
- 各レベルを個別に調整可能
- アーティスティックなコントロールとプロシージャルの利点を両立

### リアルタイムプレビュー
- **Preview Material**で即座に結果確認
- Unreal Engineでの見た目に近い状態でイテレーション
- テクスチャビューとジオメトリビューを併用

### Megascans素材の活用
- **実写スキャンデータ**をプロシージャルワークフローに統合
- リアリズムとコントロール性の両立
- チャンネル抽出で必要な情報だけを使用

### マスキングテクニック
- **SDF ベースのマスク**で効果の適用範囲を制御
- 複数のマスクを組み合わせて複雑な領域を定義
- プロシージャルな変動を加えてランダム性を追加

### バッチエクスポート最適化
- **ROP Network + Fetch + Merge**パターン
- 複数マップを一括レンダリング
- イテレーション時の時間短縮

## まとめ
**Copernicus**は、破壊シミュレーションから高品質なゲーム用テクスチャを生成する強力なツールです。プロシージャルなアプローチにより、大規模・中規模・小規模の3レベルでディテールを制御し、リアルタイムプレビューで即座に結果を確認できます。Height to Normal や Height to AO などの専用ノードにより、1つの高さマップから複数の必要なマップを自動生成できるため、**効率的で一貫性のあるテクスチャパイプライン**を構築できます。

---

# トランスクリプト

[00:24] That will pull in the geometry from the destruction sim like we had in the previous lesson. We'll then put down a rasterized setup and um, the default settings work fine for this. And then from there, a rasterized geo. And with the ized geo we can bring in the default of the p the position. And we could also add an ID attribute of active. Um, if you want, um, I don't think we use it in this setup, but just to show you all those active attributes that I created back in subs. If you click on this, um, this down here in the lower right, you can switch and see the different outputs and you can see that we can actually pull that active attribute from the RBD sim.

[01:00] But for this, we'll switch it back to position. From there, we'll connect it over to a channel split. And if we pull the blue from the channel split, that's actually pulling the depth information that we set up in SS to get it to the right range. I've done an equalize with a scale to maximum length, and now we have the depth in the correct um, format. We are creating a height texture with the depth information to take into Unreal. So looking at this texture, the white area will be flat while the darker the values go towards black, the deeper they'll be. So that is our height of our sim. So what I like to do here is if we go over here, I have another preview material. I'm just gonna drag this over here. We're visualizing a texture here, but to really see what it looks like, we need to put it on a piece of geometry. So dropping down a preview material and setting the divisions to a thousand. And I've also set the height scale and the normal map scale to 0.1. I could then take this and I could plug this directly into the height. And so if we visualize this, this is actually what we're seeing and the height values that we're getting out of our sim right now.

[02:14] So I like to use this instead of the, the texture view, um, in most cases just to get like a lay of the land. Okay. So from there, um, I realized that I wanted to lower it more. Um, 'cause it's still kind of flat. And so rather than going back to the SIM and trying to iterate over that, I decided to do it here in cups. And so what I've done is I've taken an SDF shape of a circle and I've converted that SDF to a mono and then given it a slight blur, I then equalize it and just so that it doesn't stay completely round. When we lower the center, I've added a distort here and going into the direction of the distort, I've given a, I've put down a fractal noise with the slope direction and distorted that circle shape with that. So we get something like this.

[03:09] So then from there, if we put down a subtract a, a blend nodes with it set to subtract, we're gonna take the original height value and subtract this new value from it, which will then lower the, the center even more. And so if we look at that, instead I visualize this, you can see if I just bypass this, how it's lowering it even more here. Okay? So then from there I want to start adding finer details. So, 'cause right now it's just kind of a plain looking fracture sum. So for the next step what I've done is I've taken a asphalt, a damaged asphalt texture from mega scans that will be provided. And I've pulled that in. I've then extracted, um, the red channel and I've scaled it so that we get the scale of the, the features that we want. I'm then remapping it so that the darker areas are a bit darker, and then setting that to a mono and then inverting it.

[04:20] So then now what we're gonna do here is we're gonna take and do another subtract. We're gonna take our original value here that we had and we're gonna subtract even more. And now you may not see that much has happened and this is why I like to use that preview material because we're subtracting only a 0.02 from it, but um, you don't really see it. And so if we plug this into the height now and we visit that you can actually see there's a lot of detail being added. And so if I bypass this, we're adding all that texture detail into the, the sim. We also have this subtract being masked out by that center value that I'm pulling from the SDF. So I've taken that, that same SDF, and I've remapped it so it's stronger and then I'm using that as a mask. Um, so that we're only applying that subtract where that mask is. And so you'll see it, it only happens in this space.

[05:25] Okay, so then from there I want to add another level. So it's like the, the destruction sim gave us the large pieces and the texture gave us small features and now we want something kind of in the middle. So for that, I took, uh, a procedural OID texture, um, that I've created here using a fractal noise with it set to worldly cellular. And I've remapped it. So we get just those edges. And then using another fractal that is a higher frequency, I've created a slope dur and then I'm distorting it. So basically we're distorting those edges and then I'm going to raise the gamma and then I'm gonna, 'cause if I was to apply this right now, this would, um, be the same value across the board. Um, but I want it to be stronger and weaker in areas. So I've taken a fractal noise that looks like this and I'm just multiplying it so that it gets weaker in different areas. And then I'm doing the same thing. I'm subtracting from it with the value of 0.3. And so if we look at that, you can kind of see it, um, appearing here in the the middle. Um, but if we again, look at it using the height And we just bypass this, you can kind of see all those medium sized cracks being added right on top. 

[06:53] Okay, so now we have our height where we want it. And so let's create a few maps based on this. So the first thing is, so that height directly goes right into the height. Um, but then from there we're gonna put down this awesome node called height to normal and create a normal map from it. And that goes into normal From there, we're gonna take those values from the, the height map and I'm going to then plug them into a height to ambient occlusion, which will give us something like this and then remap it so that it gets a little bit darker on the crevices. And that's gonna become our diffuse map for visualization. I've remapped it to different values so that when it goes into the preview material here, we could just get different values like that rather than white to black. Um, the last bit of info here is the, the roughness. So I've taken the, that texture that we had from the asphalt And I've multiplied it by the mask and then I've remapped it to the roughness values that I want. And then that goes into roughness. And so that is what we have here in Copernicus. 

[08:08] Now the last bit is to export it. Um, so for a game ready asset, you will want to pack them and like channel pack them into red, green, and blue. Um, but for this I did not. Um, but that would be a best practice going forward. Um, so the way I set this up is I have a few different rock image outputs. Um, so I'm outputting the diffuse, the roughness, the normal, the height and the mask. A quick little trick here is, um, say you're iterating on this and you don't want to, um, press render, um, five times for each iteration. What you can do is once you have that set up, you can drop down a rock network and then you can do a fetch and fetch all of those and then just plug them into a merge and then press render here and it'll go through and render them all out for um, every time you iterate on this. So that is the Copernicus setup. And now let's jump over to Unreal.
