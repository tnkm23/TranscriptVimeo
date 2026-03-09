# 45 | Rendering Basics | COPs

## 学習ノート

### 概要
このビデオでは、Houdini の **Solaris** 内で **COP(Compositing Operations:合成操作)** を使用して、レンダリング画像に基本的な画像処理を直接適用する方法を解説しています。特に **Slap Comp** という機能を使って、2D画像処理をリアルタイムで3Dビューポートに反映させる手法を学びます。

### 重要な概念

#### **COP Network(Copernicus Network)**
- Houdini内の **2D画像合成専用ネットワーク**
- レンダリング画像に対して色補正、グロー効果、その他のポストプロセス効果を適用
- **COPネットワーク** または **Copernicus** として参照される

#### **Slap Comp Import**
- レンダリング画像をCOPネットワークにインポートするノード
- **「Add AOVs from last render」** ボタンで最後のレンダリング結果を自動的に読み込み
- ビューアに2Dフラット画像として表示される

#### **Slap Comp Block**
- **静的コンポジット** ではなく **動的コンポジット** を可能にする重要なノード
- ブロック内に配置したCOP処理が **Solaris のビューポートにリアルタイムで反映** される
- **カメラに依存しない** ため、どのカメラからレンダリングしても同じ色補正が適用される

#### **HSB Adjust(色補正)**
- **Hue(色相)、Saturation(彩度)、Brightness(明度)** を調整するノード
- 彩度を上げることで画像をより鮮やかに
- 色相シフトで画像全体の色調を変更

#### **Glow(グロー効果)**
- 明るい部分に光の滲み効果を追加
- **Brightness** と **Size** パラメータで効果の強さと範囲を調整
- 画像に柔らかく幻想的な印象を与える

### 実装手順

#### 1. COPネットワークの作成
1. ノードネットワークで **Tab** キーを押し、「**cop**」と入力して **COP Network** を作成
2. 最終出力ノードの隣に配置し、「**slap comp**」と名前を付ける
3. ネットワーク内に入る(**i** キーまたはダブルクリック)

#### 2. Slap Comp Import の使用(静的方法)
1. **Slap Comp Import** ノードを作成
2. **「Add AOVs from last render」** ボタンをクリックしてレンダリング画像を読み込み
3. 新しい **Pane** を作成し、**Viewers → Composite View** を選択して画像を表示
4. **HSB Adjust** や **Glow** などのノードを接続して画像処理を適用
5. **注意**: この方法では変更が Solaris のビューポートに自動反映されない(静的コンポジット)

#### 3. Slap Comp Block の使用(動的方法・推奨)
1. **Slap Comp Block** ノードを作成
2. ノードを配置すると、自動的にレンダリング画像が読み込まれ、**Begin/End Block** 構造が作成される
3. ブロック内に **HSB Adjust** ノードを配置
   - **Saturation** を上げて彩度を調整
   - **Hue Shift** で色調を変更
4. **Glow** ノードを追加
   - **Brightness** と **Size** で光の滲み効果を調整
5. **Stage(Solaris)に戻る**
6. カメラノードで **「Enable corrections」** をオンにする
7. **リアルタイムで色補正が反映される**ことを確認

#### 4. リアルタイム確認
- ライトを移動すると、色補正が適用された状態でレンダリングが更新される
- 異なるカメラに切り替えても、同じ色補正が適用される(**カメラ非依存**)
- Shade Wall などの別のビューに切り替えても、色補正は維持される

### 応用方法

#### シーケンスレベルのライティングとコンポジット
- **シーケンス全体で一貫した色調** を維持しながら、ライティングを調整
- リアルタイムで色補正とライティングの相互作用を確認できるため、**反復作業が高速化**

#### 複数カメラでの統一されたルック
- Slap Comp Block を使用することで、**全カメラで同じ色補正** が自動適用
- カメラごとに個別に色補正を設定する手間を省略

#### ライブフィードバックによるアーティスティックな調整
- ライティングアーティストとコンポジターが **同時に作業** できる環境を構築
- 3Dシーン内で最終的なルックをリアルタイムプレビュー

#### ポストプロセスエフェクトの実験
- グロー、ブルーム、色収差、ビネット効果などを **Copernicus の豊富なノード** で試行
- 結果を即座に3Dビューポートで確認できるため、**クリエイティブな実験が容易**

### まとめ
**Slap Comp Block** は、Houdini の強力な機能であり、2D画像処理を3Dワークフローに統合します。これにより、レンダリング後の色補正をリアルタイムで確認しながら、ライティングやカメラワークを調整できます。特に **シーケンス制作** や **複数カメラのプロジェクト** では、作業効率とクリエイティブな柔軟性が大幅に向上します。

---

## トランスクリプト

To finish up this part of the course, I wanna talk about how to create the slap coms inside Houdini and inside Solaris. So at this point you have your render image and what you need to do is go to our Cup network or Copernicus to create a slap com. So in this case, I will go and type cup for cup network. I will just place it somewhere next to our final output. I will go here and call this slap comp and then I will go inside. So you will see that the contacts empty at the moment and we have this option to bring these two notes. So the first one is gonna be slap comp block that we're gonna talk about in a moment. But I will start with this slab com import.

And what this will do is that it will give you a couple options to bring in your image. So by default nothing's happened, but if you hit this add AOBs from last render, you will see that. Now you have your image on this viewer. So you can see it's a 2D image, it's flat. But here what is interesting is that you can go here and create the new pen and then we're gonna go to viewers and com site view. And here we can see that we have our image and we can have all the usual suspects to treat uh, to D image. At this point, we can go and use 2D nodes to modify our image. So I will go with HSB adjust and I will connect it here. I will go and connect the color information to the source and then I will go and see it. And then what I wanna do is, for instance, give more saturation to our image, give a little bit of a shift so you can see that now it's white glowy, and then we can add a glow in top of it. So I will just go and connect a new note. And here we can see that we can add a little bit of brightness, we can add a little bit of size. And this is kind of how we can design our final output of the image. So right now, let me go back to our stage and then go back to our simbu and you will see that nothing has been transferred here. And the reason for this is because the way we did it over here, so in your terms, you have this option to control the lab laptop settings, and if you turn on you should expect to see any uh, color corrections, anything that you have done to your slap comms and then keep working on your DPH render. However, if we go back to our slap com, because we did a through this method, we kind of end up having a static and composite. So what we're gonna show you next is that we can remove these guys. I will go and create a new slap com block and then I would drag it.

So you will see that it automatically bring the same image. But what is interesting is that it will create this for loop or this block. So anything that you put place inside here will be transferred or can be transferred back to your viewer inside Solaris. So in this case, I will go and do like the same operation. I will bring uh, HSB operation here. Then I will change the saturation. You can view it here and then shift the values. So something not nice, but so we can see that it's actually changing things. We can go and add low, we can connect it here. So let me just actually connect it to the, to the right one. Then let me just make sure that I'm picking up what I want. So in this case, I will start doing kind of the same thing. We have this glow, we can increase the brightness, right? So something about there, and this is how we are transforming our image. So there you go. So now you have that block.

Now that you go back to the stage, nothing of that has been transferred automatically. So here you can enable those corrections. And what is interesting is that it is agnostic of the camera. So as soon as you go here, you will see that you have the same kind of parameters, the same settings. So it's very, very interesting when you're working, for instance, sequence level cytes and sequence level lighting, how you can see your color correction at the same time that you do your render. So at this point you can just move your light and it will really hold up, right? Whatever you have for your lighting and for your composite, for your image. So you can see that right now it has the same core corrections that you have here. Then you can from here and let's say that you want to change this situation. So let's say that in this case you want it to be uh, a little bit more derated. So here we are in a 2D image. As you can see that here has been automatically updated to whatever camera you're rendering. You can go back here and then pick again our shade wall. Let me just go back here and you can see that the color corrections has been transferred to our viewer. So it's a very powerful tool, not only because it's kind of the compositing package that you have inside Houdini, but also because it allows you to connect it live to whatever work you do on your three DC. So very, very nice and very neat feature that we have here with Copernicus.
